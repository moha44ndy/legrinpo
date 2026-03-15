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

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val webView = findViewById<WebView>(R.id.webview)
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.userAgentString = settings.userAgentString + " LegrinpoWebView/1.0"

        webView.loadUrl(legrinpoUrl)
    }
}
