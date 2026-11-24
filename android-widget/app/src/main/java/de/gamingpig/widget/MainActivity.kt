package de.gamingpig.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

class MainActivity : Activity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    private lateinit var updateBanner: LinearLayout
    private lateinit var txtUpdateTitle: TextView
    private lateinit var txtUpdateNotes: TextView
    private lateinit var btnInstallUpdate: Button

    private lateinit var previewBox: FrameLayout
    private lateinit var previewBgImage: ImageView
    private lateinit var previewCover: ImageView
    private lateinit var previewTitle: TextView
    private lateinit var previewArtist: TextView
    private lateinit var previewStatus: TextView
    private lateinit var previewBrand: TextView
    private lateinit var previewRecent: TextView
    private lateinit var previewProgress: ProgressBar

    private lateinit var btnAuto: Button
    private lateinit var btnAmbientBlur: Button
    private lateinit var btnAmbientColor: Button
    private lateinit var btnLiquid: Button
    private lateinit var btnLight: Button
    private lateinit var btnOled: Button
    private lateinit var btnCyber: Button

    private lateinit var btnSizeSmall: Button
    private lateinit var btnSizeNormal: Button
    private lateinit var btnSizeLarge: Button

    private lateinit var switchProgress: Switch
    private lateinit var switchTimeline: Switch
    private lateinit var switchRecent: Switch

    private val previewTicker = object : Runnable {
        override fun run() {
            val snap = GamingpigWidgetProvider.lastSnapshot
            val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            val showTimeline = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_TIMELINE, true)
            if (snap != null && snap.isPlaying) {
                val now = System.currentTimeMillis()
                val curMs = snap.currentProgressMs(now)
                previewProgress.progress = snap.currentProgressPct(now)
                if (showTimeline && snap.durationMs > 0L) {
                    previewBrand.text = "${TrackDataFetcher.formatTime(curMs)} / ${TrackDataFetcher.formatTime(snap.durationMs)}"
                } else {
                    previewBrand.text = "GAMINGPIG"
                }
                if (snap.remainingMs(now) <= 1000L && (now - snap.fetchedAtMs) >= 4000L) {
                    loadLivePreview()
                }
            }
            mainHandler.postDelayed(this, 1000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        updateBanner = findViewById(R.id.update_banner)
        txtUpdateTitle = findViewById(R.id.txt_update_title)
        txtUpdateNotes = findViewById(R.id.txt_update_notes)
        btnInstallUpdate = findViewById(R.id.btn_install_update)

        findViewById<TextView>(R.id.txt_app_version).text =
            "v${UpdateChecker.getCurrentVersionName(this)} · Homescreen Live-Anzeige"

        previewBox = findViewById(R.id.preview_box)
        previewBgImage = findViewById(R.id.preview_bg_image)
        previewCover = findViewById(R.id.preview_cover)
        previewTitle = findViewById(R.id.preview_title)
        previewArtist = findViewById(R.id.preview_artist)
        previewStatus = findViewById(R.id.preview_status)
        previewBrand = findViewById(R.id.preview_brand)
        previewRecent = findViewById(R.id.preview_recent)
        previewProgress = findViewById(R.id.preview_progress)

        btnAuto = findViewById(R.id.btn_theme_auto)
        btnAmbientBlur = findViewById(R.id.btn_theme_ambient_blur)
        btnAmbientColor = findViewById(R.id.btn_theme_ambient_color)
        btnLiquid = findViewById(R.id.btn_theme_liquid)
        btnLight = findViewById(R.id.btn_theme_light)
        btnOled = findViewById(R.id.btn_theme_oled)
        btnCyber = findViewById(R.id.btn_theme_cyber)

        btnSizeSmall = findViewById(R.id.btn_size_small)
        btnSizeNormal = findViewById(R.id.btn_size_normal)
        btnSizeLarge = findViewById(R.id.btn_size_large)

        switchProgress = findViewById(R.id.switch_progress)
        switchTimeline = findViewById(R.id.switch_timeline)
        switchRecent = findViewById(R.id.switch_recent)

        val btnPin = findViewById<Button>(R.id.btn_pin_widget)
        val txtHint = findViewById<TextView>(R.id.txt_pin_hint)

        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            btnPin.text = "✓ Speichern & Widget anwenden"
            txtHint.text = "Dein Widget auf dem Homescreen übernimmt sofort dieses Design."
        }

        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val savedTheme = prefs.getString(GamingpigWidgetProvider.KEY_THEME, "auto") ?: "auto"
        val savedSize = prefs.getString(GamingpigWidgetProvider.KEY_TEXT_SIZE, "normal") ?: "normal"
        val savedProgress = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_PROGRESS, true)
        val savedTimeline = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_TIMELINE, true)
        val savedRecent = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_RECENT, false)

        switchProgress.isChecked = savedProgress
        switchTimeline.isChecked = savedTimeline
        switchRecent.isChecked = savedRecent

        applyPreviewTheme(savedTheme, savedSize, savedProgress, savedRecent)

        btnAuto.setOnClickListener { saveAndApplyTheme("auto") }
        btnAmbientBlur.setOnClickListener { saveAndApplyTheme("ambient_blur") }
        btnAmbientColor.setOnClickListener { saveAndApplyTheme("ambient_color") }
        btnLiquid.setOnClickListener { saveAndApplyTheme("liquid") }
        btnLight.setOnClickListener { saveAndApplyTheme("light") }
        btnOled.setOnClickListener { saveAndApplyTheme("oled") }
        btnCyber.setOnClickListener { saveAndApplyTheme("cyber") }

        btnSizeSmall.setOnClickListener { saveAndApplySize("small") }
        btnSizeNormal.setOnClickListener { saveAndApplySize("normal") }
        btnSizeLarge.setOnClickListener { saveAndApplySize("large") }

        switchProgress.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_PROGRESS, isChecked).apply()
            previewProgress.visibility = if (isChecked) View.VISIBLE else View.GONE
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        switchTimeline.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_TIMELINE, isChecked).apply()
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        switchRecent.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_RECENT, isChecked).apply()
            refreshPreviewFromSnapshot()
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        btnPin.setOnClickListener {
            requestNotificationPermissionIfNeeded()
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                GamingpigWidgetProvider.refreshAllWidgets(this)
                val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                setResult(RESULT_OK, result)
                finish()
                return@setOnClickListener
            }
            pinWidgetToHomescreen()
        }

        findViewById<Button>(R.id.btn_refresh_now).setOnClickListener {
            loadLivePreview()
            checkForAppUpdate()
            GamingpigWidgetProvider.refreshAllWidgets(this, showSyncFeedback = true)
            Toast.makeText(this, "Live-Daten & Updates werden geprüft...", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.btn_open_web).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://gamingpig.github.io/about-qa/?mode=widget")))
        }

        requestNotificationPermissionIfNeeded()
        loadLivePreview()
        checkForAppUpdate()
    }

    override fun onResume() {
        super.onResume()
        mainHandler.removeCallbacks(previewTicker)
        mainHandler.postDelayed(previewTicker, 1000L)
    }

    override fun onPause() {
        super.onPause()
        mainHandler.removeCallbacks(previewTicker)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 3001)
            }
        }
    }

    private fun checkForAppUpdate() {
        executor.execute {
            val info = UpdateChecker.fetchUpdateInfo(this)
            runOnUiThread {
                if (info != null && info.isUpdateAvailable) {
                    updateBanner.visibility = View.VISIBLE
                    txtUpdateTitle.text = "🚀 Update v${info.versionName} verfügbar!"
                    txtUpdateNotes.text = info.notes
                    btnInstallUpdate.setOnClickListener {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(info.apkUrl)))
                    }
                } else {
                    updateBanner.visibility = View.GONE
                }
            }
        }
    }

    private fun saveAndApplyTheme(theme: String) {
        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(GamingpigWidgetProvider.KEY_THEME, theme).apply()
        val size = prefs.getString(GamingpigWidgetProvider.KEY_TEXT_SIZE, "normal") ?: "normal"
        applyPreviewTheme(theme, size, switchProgress.isChecked, switchRecent.isChecked)
        GamingpigWidgetProvider.refreshAllWidgets(this)
    }

    private fun saveAndApplySize(size: String) {
        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(GamingpigWidgetProvider.KEY_TEXT_SIZE, size).apply()
        val theme = prefs.getString(GamingpigWidgetProvider.KEY_THEME, "auto") ?: "auto"
        applyPreviewTheme(theme, size, switchProgress.isChecked, switchRecent.isChecked)
        GamingpigWidgetProvider.refreshAllWidgets(this)
    }

    private fun applyPreviewTheme(savedTheme: String, savedSize: String, showProgress: Boolean, showRecent: Boolean) {
        val effectiveTheme = GamingpigWidgetProvider.resolveEffectiveTheme(this, savedTheme)
        val isLight = (effectiveTheme == "light")
        val snap = GamingpigWidgetProvider.lastSnapshot

        when {
            effectiveTheme == "ambient_blur" && snap?.blurredBgBitmap != null -> {
                previewBox.setBackgroundResource(0)
                previewBgImage.visibility = View.VISIBLE
                previewBgImage.setImageBitmap(snap.blurredBgBitmap)
            }
            effectiveTheme == "ambient_color" && snap != null -> {
                previewBox.setBackgroundResource(0)
                previewBgImage.visibility = View.VISIBLE
                val bmp = Bitmap.createBitmap(240, 160, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = snap.dominantColor }
                canvas.drawRoundRect(RectF(0f, 0f, 240f, 160f), 26f, 26f, paint)
                previewBgImage.setImageBitmap(bmp)
            }
            else -> {
                previewBgImage.visibility = View.GONE
                val bgRes = when (effectiveTheme) {
                    "light" -> R.drawable.widget_bg_light
                    "oled" -> R.drawable.widget_bg_oled
                    "cyber" -> R.drawable.widget_bg_cyber
                    else -> R.drawable.widget_bg_liquid
                }
                previewBox.setBackgroundResource(bgRes)
            }
        }

        val delta = when (savedSize) {
            "small" -> -2f
            "large" -> 2.5f
            else -> 0f
        }
        previewTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f + delta)
        previewArtist.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f + delta)
        previewRecent.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f + (delta * 0.5f))

        previewProgress.visibility = if (showProgress) View.VISIBLE else View.GONE

        previewTitle.setTextColor(Color.parseColor(if (isLight) "#0F172A" else "#FFFFFF"))
        previewArtist.setTextColor(Color.parseColor(if (isLight) "#475569" else "#CBD5E1"))
        previewBrand.setTextColor(Color.parseColor(if (isLight) "#475569" else "#94A3B8"))
        previewRecent.setTextColor(Color.parseColor(if (isLight) "#64748B" else "#94A3B8"))

        val activeTint = ColorStateList.valueOf(Color.parseColor("#0284C7"))
        val idleTint = ColorStateList.valueOf(Color.parseColor("#1E293B"))

        btnAuto.backgroundTintList = if (savedTheme == "auto") activeTint else idleTint
        btnAmbientBlur.backgroundTintList = if (savedTheme == "ambient_blur") activeTint else idleTint
        btnAmbientColor.backgroundTintList = if (savedTheme == "ambient_color") activeTint else idleTint
        btnLiquid.backgroundTintList = if (savedTheme == "liquid") activeTint else idleTint
        btnLight.backgroundTintList = if (savedTheme == "light") activeTint else idleTint
        btnOled.backgroundTintList = if (savedTheme == "oled") activeTint else idleTint
        btnCyber.backgroundTintList = if (savedTheme == "cyber") activeTint else idleTint

        btnSizeSmall.backgroundTintList = if (savedSize == "small") activeTint else idleTint
        btnSizeNormal.backgroundTintList = if (savedSize == "normal") activeTint else idleTint
        btnSizeLarge.backgroundTintList = if (savedSize == "large") activeTint else idleTint

        refreshPreviewFromSnapshot()
    }

    private fun refreshPreviewFromSnapshot() {
        val snap = GamingpigWidgetProvider.lastSnapshot ?: return
        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val showRecent = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_RECENT, false)
        val showTimeline = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_TIMELINE, true)
        val now = System.currentTimeMillis()

        previewTitle.text = snap.title
        previewArtist.text = snap.artist
        previewStatus.text = if (snap.isPlaying) "NOW PLAYING" else "STANDBY"
        previewStatus.setTextColor(Color.parseColor(if (snap.isPlaying) "#34D399" else "#94A3B8"))
        previewProgress.progress = snap.currentProgressPct(now)

        if (snap.isPlaying && showTimeline && snap.durationMs > 0L) {
            previewBrand.text = "${TrackDataFetcher.formatTime(snap.currentProgressMs(now))} / ${TrackDataFetcher.formatTime(snap.durationMs)}"
        } else {
            previewBrand.text = "GAMINGPIG"
        }

        if (showRecent && snap.recentTracks.isNotEmpty()) {
            previewRecent.text = "🕒 Zuletzt: ${snap.recentTracks[0].title} · ${snap.recentTracks[0].artist}"
            previewRecent.visibility = View.VISIBLE
        } else {
            previewRecent.visibility = View.GONE
        }

        if (snap.artBitmap != null) {
            previewCover.setImageBitmap(snap.artBitmap)
        }
    }

    private fun pinWidgetToHomescreen() {
        val manager = AppWidgetManager.getInstance(this)
        val provider = ComponentName(this, GamingpigWidgetProvider::class.java)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.isRequestPinAppWidgetSupported) {
            val accepted = manager.requestPinAppWidget(provider, null, null)
            if (accepted) {
                Toast.makeText(this, "Tippe auf 'Hinzufügen', um das Widget zu platzieren!", Toast.LENGTH_LONG).show()
            } else {
                Toast.makeText(this, "Dein Launcher blockiert direktes Anheften. Ziehe das Widget über das Launcher-Menü auf den Homescreen.", Toast.LENGTH_LONG).show()
            }
        } else {
            Toast.makeText(this, "Bitte füge das Widget über langes Drücken auf dem Homescreen -> Widgets hinzu.", Toast.LENGTH_LONG).show()
        }
    }

    private fun loadLivePreview() {
        executor.execute {
            val snap = TrackDataFetcher.fetchCurrentTrack()
            GamingpigWidgetProvider.lastSnapshot = snap
            runOnUiThread {
                val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                val theme = prefs.getString(GamingpigWidgetProvider.KEY_THEME, "auto") ?: "auto"
                val size = prefs.getString(GamingpigWidgetProvider.KEY_TEXT_SIZE, "normal") ?: "normal"
                applyPreviewTheme(theme, size, switchProgress.isChecked, switchRecent.isChecked)
            }
        }
    }
}
