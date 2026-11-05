package expo.modules.playgames

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.Snapshot
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Thin wrapper over Play Games Services v2. Nothing here runs unless the build has a Play Games project ID
 * (see plugins/withPlayGames.js); without one, `isAvailable` is false and the JS side does nothing.
 *
 * Achievement and leaderboard calls use the queued (non-"Immediate") APIs, so they work offline and
 * Play Games sends them when the phone is back online.
 */
class PlayGamesModule : Module() {
  private val activity: Activity
    get() = appContext.currentActivity ?: throw Exceptions.MissingActivity()

  // The cloud save is opened, merged in JS, then committed; this holds it in between.
  private val saveLock = Mutex()
  private var openSave: Snapshot? = null

  override fun definition() = ModuleDefinition {
    Name("PlayGames")

    Function("isAvailable") { available() }

    AsyncFunction("isAuthenticated") Coroutine { ->
      traced("isAuthenticated") {
        ensureAvailable()
        PlayGames.getGamesSignInClient(activity).isAuthenticated.await().isAuthenticated
      }
    }

    AsyncFunction("signIn") Coroutine { ->
      traced("signIn") {
        ensureAvailable()
        PlayGames.getGamesSignInClient(activity).signIn().await().isAuthenticated
      }
    }

    AsyncFunction("getPlayer") Coroutine { ->
      traced("getPlayer") {
        ensureAvailable()
        val p = PlayGames.getPlayersClient(activity).currentPlayer.await()
        mapOf("id" to p.playerId, "name" to p.displayName)
      }
    }

    Function("unlockAchievement") { id: String ->
      ensureAvailable()
      Log.d(TAG, "unlockAchievement $id")
      PlayGames.getAchievementsClient(activity).unlock(id)
    }

    // Idempotent: progress never goes down, so syncing the same total twice is harmless.
    Function("setAchievementSteps") { id: String, steps: Int ->
      ensureAvailable()
      Log.d(TAG, "setAchievementSteps $id $steps")
      if (steps > 0) PlayGames.getAchievementsClient(activity).setSteps(id, steps)
    }

    // The queued submitScore() drops scores sent while offline, so use the immediate call and let JS retry on failure.
    AsyncFunction("submitScore") Coroutine { leaderboardId: String, score: Double ->
      traced("submitScore $leaderboardId ${score.toLong()}") {
        ensureAvailable()
        PlayGames.getLeaderboardsClient(activity).submitScoreImmediate(leaderboardId, score.toLong()).await()
        Unit
      }
    }

    AsyncFunction("showAchievements") Coroutine { ->
      traced("showAchievements") { show(PlayGames.getAchievementsClient(activity).achievementsIntent.await()) }
    }

    AsyncFunction("showLeaderboards") Coroutine { ->
      traced("showLeaderboards") { show(PlayGames.getLeaderboardsClient(activity).allLeaderboardsIntent.await()) }
    }

    AsyncFunction("showLeaderboard") Coroutine { id: String ->
      traced("showLeaderboard $id") { show(PlayGames.getLeaderboardsClient(activity).getLeaderboardIntent(id).await()) }
    }

    // Opens the named cloud save and returns the contents of every version found: the saved one plus any
    // conflicting copies from other phones, so JS can merge them all. Follow with commitSave or closeSave.
    AsyncFunction("openSave") Coroutine { name: String ->
      traced("openSave $name") { saveLock.withLock {
        openSave?.let { runCatching { client().discardAndClose(it).await() } }
        openSave = null

        val found = mutableListOf<String>()
        var result = client().open(name, true, SnapshotsClient.RESOLUTION_POLICY_MANUAL).await()
        var rounds = 0
        while (result.isConflict && rounds++ < 5) {
          val conflict = result.conflict!!
          read(conflict.conflictingSnapshot)?.let(found::add)
          read(conflict.snapshot)?.let(found::add)
          result = client().resolveConflict(conflict.conflictId, conflict.snapshot).await()
        }
        val snapshot = result.data ?: throw IllegalStateException("Cloud save still in conflict")
        read(snapshot)?.let(found::add)
        openSave = snapshot
        Log.d(TAG, "openSave: ${found.size} version(s), conflicts resolved: $rounds")
        found.distinct()
      } }
    }

    AsyncFunction("commitSave") Coroutine { data: String, description: String ->
      traced("commitSave ${data.length} chars") { saveLock.withLock {
        val snapshot = openSave ?: throw IllegalStateException("openSave first")
        openSave = null
        snapshot.snapshotContents.writeBytes(data.toByteArray(Charsets.UTF_8))
        client().commitAndClose(snapshot, SnapshotMetadataChange.Builder().setDescription(description).build()).await()
        Unit
      } }
    }

    AsyncFunction("closeSave") Coroutine { ->
      traced("closeSave") {
        saveLock.withLock {
          openSave?.let { client().discardAndClose(it).await() }
          openSave = null
        }
      }
    }
  }

  private fun client() = PlayGames.getSnapshotsClient(activity)

  /** Logs each call and its outcome (tag EcoPlayGames), including Google's status code on failures. */
  private suspend fun <T> traced(name: String, block: suspend () -> T): T {
    Log.d(TAG, "$name: start")
    try {
      val result = block()
      Log.d(TAG, "$name: ok -> $result")
      return result
    } catch (e: Throwable) {
      val status = (e as? ApiException ?: e.cause as? ApiException)?.let { " [status ${it.statusCode}: ${it.status.statusMessage}]" } ?: ""
      Log.w(TAG, "$name: FAILED ${e.javaClass.simpleName}: ${e.message}$status", e)
      throw e
    }
  }

  private fun read(s: Snapshot): String? =
    s.snapshotContents.readFully()?.takeIf { it.isNotEmpty() }?.toString(Charsets.UTF_8)

  private suspend fun show(intent: Intent) = withContext(Dispatchers.Main) {
    activity.startActivityForResult(intent, REQUEST_CODE)
  }

  private fun available(): Boolean {
    val context = appContext.reactContext ?: return false
    if (!PlayGamesPackage.hasAppId(context)) return false
    return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
  }

  private fun ensureAvailable() {
    if (!available()) throw IllegalStateException("Play Games isn't set up in this build")
  }

  companion object {
    private const val REQUEST_CODE = 9004
    private const val TAG = "EcoPlayGames"
  }
}
