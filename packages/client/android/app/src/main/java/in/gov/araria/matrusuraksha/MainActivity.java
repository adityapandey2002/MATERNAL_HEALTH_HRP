package in.gov.araria.matrusuraksha;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

/**
 * Hardens the WebView surface for a device that holds patient records.
 *
 * FLAG_SECURE prevents screenshots and screen recording, and also keeps the
 * app out of the recent-tasks thumbnail. WebView debugging is already off in
 * capacitor.config.ts, but we re-assert it here so a misconfigured build
 * cannot leak the DOM to an attached debugger.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
    );

    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().setWebContentsDebuggingEnabled(false);
    }
  }
}