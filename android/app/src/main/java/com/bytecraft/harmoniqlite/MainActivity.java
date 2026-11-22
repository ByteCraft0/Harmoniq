package com.bytecraft.harmoniqlite;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HarmoniqAudioPlayerPlugin.class);
        registerPlugin(HarmoniqMediaScannerPlugin.class);
        super.onCreate(savedInstanceState);

        // Start native background audio playback service
        try {
            Intent serviceIntent = new Intent(this, HarmoniqMediaService.class);
            startService(serviceIntent);
        } catch (Exception ignored) {}

        // Notification permission is no longer requested unconditionally on every launch.
        // It is checked gracefully and requested via user action or settings.
    }
}
