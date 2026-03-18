package com.legrinpo.www.twa

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * Application WebView pour Legrinpo.
 * Charge https://www.legrinpo.com avec le même package name que la TWA (com.legrinpo.www.twa)
 * pour obtenir l'accès production sur Google Play. Une fois l'accès obtenu, vous pourrez
 * publier la version TWA avec le même package name.
 */
class MainActivity : AppCompatActivity() {

    private val legrinpoUrl = "https://www.legrinpo.com"
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
                val url = request.url?.toString() ?: return false
                // On garde la navigation "dans l'app" pour les liens web classiques.
                return if (url.startsWith("http://") || url.startsWith("https://")) {
                    view.loadUrl(url)
                    true
                } else {
                    // Ex: tel:, mailto:, intent: -> laisse Android gérer.
                    false
                }
            }
        }
        webView.webChromeClient = WebChromeClient()

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.userAgentString = settings.userAgentString + " LegrinpoWebView/1.0"
        settings.loadsImagesAutomatically = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        webView.loadUrl(legrinpoUrl)
    }

    override fun onBackPressed() {
        // Permet de revenir dans l'historique du site (au lieu de fermer l'app).
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
            return
        }
        super.onBackPressed()
    }
}
