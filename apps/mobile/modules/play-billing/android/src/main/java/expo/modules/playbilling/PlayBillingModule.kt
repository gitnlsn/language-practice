package expo.modules.playbilling

import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

/**
 * Thin wrapper over Google Play Billing for subscriptions. Talks only to the Google Play app on the phone; no other
 * server. Purchases are checked on the device (no backend), and Play keeps them cached, so they work offline.
 */
class PlayBillingModule : Module() {
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var client: BillingClient? = null
  private var purchaseFlow: CompletableDeferred<Pair<BillingResult, List<Purchase>>>? = null
  private val details = mutableMapOf<String, ProductDetails>()

  private val listener = PurchasesUpdatedListener { result, purchases ->
    val list = purchases.orEmpty()
    val flow = purchaseFlow
    if (flow != null && !flow.isCompleted) flow.complete(result to list)
    // Also covers purchases that finish later (e.g. a pending payment that clears).
    else if (result.responseCode == BillingResponseCode.OK) sendEvent("onPurchasesUpdated", mapOf("purchases" to list.map(::toMap)))
  }

  override fun definition() = ModuleDefinition {
    Name("PlayBilling")
    Events("onPurchasesUpdated")

    // Subscription products with their base plans and offers (free trial etc.), priced for the player's country.
    AsyncFunction("getSubscriptions") Coroutine { ids: List<String> ->
      val params = QueryProductDetailsParams.newBuilder()
        .setProductList(ids.map {
          QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.SUBS).build()
        })
        .build()
      val result = ready().queryProductDetails(params)
      check(result.billingResult)
      result.productDetailsList.orEmpty().map { p ->
        details[p.productId] = p
        mapOf(
          "productId" to p.productId,
          "name" to p.name,
          "title" to p.title,
          "description" to p.description,
          "offers" to p.subscriptionOfferDetails.orEmpty().map { o ->
            mapOf(
              "basePlanId" to o.basePlanId,
              "offerId" to o.offerId,
              "offerToken" to o.offerToken,
              "tags" to o.offerTags,
              "phases" to o.pricingPhases.pricingPhaseList.map { ph ->
                mapOf(
                  "price" to ph.formattedPrice,
                  "priceMicros" to ph.priceAmountMicros.toDouble(),
                  "currency" to ph.priceCurrencyCode,
                  "period" to ph.billingPeriod,
                  "cycles" to ph.billingCycleCount,
                  "recurrence" to ph.recurrenceMode,
                )
              },
            )
          },
        )
      }
    }

    // Shows Google Play's purchase sheet. Resolves with the purchases, or rejects with "cancelled" / the error.
    AsyncFunction("purchase") Coroutine { productId: String, offerToken: String ->
      val product = details[productId] ?: throw IllegalStateException("Call getSubscriptions first")
      val params = BillingFlowParams.newBuilder()
        .setProductDetailsParamsList(listOf(
          BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offerToken).build()
        ))
        .build()
      val billing = ready()
      val flow = CompletableDeferred<Pair<BillingResult, List<Purchase>>>()
      purchaseFlow = flow
      val launched = withContext(Dispatchers.Main) {
        billing.launchBillingFlow(appContext.currentActivity ?: throw Exceptions.MissingActivity(), params)
      }
      if (launched.responseCode != BillingResponseCode.OK) {
        purchaseFlow = null
        check(launched)
      }
      val (result, purchases) = flow.await()
      purchaseFlow = null
      if (result.responseCode == BillingResponseCode.USER_CANCELED) throw IllegalStateException("cancelled")
      check(result)
      purchases.map(::toMap)
    }

    // Active subscriptions, from Google Play's cache on the phone (works offline).
    AsyncFunction("getPurchases") Coroutine { ->
      val result = ready().queryPurchasesAsync(
        QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
      )
      check(result.billingResult)
      result.purchasesList.map(::toMap)
    }

    // Must be called within 3 days of a purchase, or Google refunds it.
    AsyncFunction("acknowledge") Coroutine { token: String ->
      check(ready().acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()))
    }

    // Google Play's own page for managing or cancelling the subscription.
    Function("openManageSubscriptions") { productId: String? ->
      val pkg = context.packageName
      val url = if (productId == null) "https://play.google.com/store/account/subscriptions?package=$pkg"
      else "https://play.google.com/store/account/subscriptions?sku=$productId&package=$pkg"
      context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    OnDestroy {
      client?.endConnection()
      client = null
    }
  }

  private suspend fun ready(): BillingClient {
    client?.takeIf { it.isReady }?.let { return it }
    val c = client ?: BillingClient.newBuilder(context)
      .setListener(listener)
      .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().enablePrepaidPlans().build())
      .enableAutoServiceReconnection()
      .build()
      .also { client = it }
    val result = suspendCancellableCoroutine { cont ->
      c.startConnection(object : BillingClientStateListener {
        override fun onBillingSetupFinished(r: BillingResult) {
          if (cont.isActive) cont.resume(r)
        }
        override fun onBillingServiceDisconnected() {}
      })
    }
    check(result)
    return c
  }

  private fun check(r: BillingResult) {
    if (r.responseCode != BillingResponseCode.OK) throw IllegalStateException("Billing error ${r.responseCode}: ${r.debugMessage}")
  }

  private fun toMap(p: Purchase) = mapOf(
    "productIds" to p.products,
    "token" to p.purchaseToken,
    "orderId" to p.orderId,
    "state" to when (p.purchaseState) {
      Purchase.PurchaseState.PURCHASED -> "purchased"
      Purchase.PurchaseState.PENDING -> "pending"
      else -> "unknown"
    },
    "acknowledged" to p.isAcknowledged,
    "autoRenewing" to p.isAutoRenewing,
    "time" to p.purchaseTime.toDouble(),
  )
}
