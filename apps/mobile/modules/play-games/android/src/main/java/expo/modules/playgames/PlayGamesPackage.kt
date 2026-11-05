package expo.modules.playgames

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/** Google asks for PlayGamesSdk.initialize in Application.onCreate; this hooks it in without touching android/. */
class PlayGamesPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        if (hasAppId(application)) PlayGamesSdk.initialize(application)
      }
    })

  companion object {
    const val APP_ID_KEY = "com.google.android.gms.games.APP_ID"

    fun hasAppId(context: Context): Boolean {
      val meta = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA).metaData
      return !meta?.get(APP_ID_KEY)?.toString().isNullOrBlank()
    }
  }
}
