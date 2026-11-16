package com.aleksovski.exyuradio.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final String HOME = "https://acealeksa1234-a11y.github.io/EX-YU-Radio-Web/";
    private WebView radio;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff07111f);
        getWindow().setNavigationBarColor(0xff07111f);
        radio = new WebView(this);
        radio.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        radio.setBackgroundColor(0xff07111f);
        WebSettings settings = radio.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        radio.setWebChromeClient(new WebChromeClient());
        radio.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("acealeksa1234-a11y.github.io".equalsIgnoreCase(uri.getHost()) &&
                        uri.getPath() != null && uri.getPath().startsWith("/EX-YU-Radio-Web/")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    // If no external handler is available, stay in the radio.
                }
                return true;
            }
        });
        setContentView(radio);
        radio.loadUrl(HOME);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (radio != null && radio.canGoBack()) {
            radio.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onDestroy() {
        if (radio != null) {
            radio.destroy();
            radio = null;
        }
        super.onDestroy();
    }
}
