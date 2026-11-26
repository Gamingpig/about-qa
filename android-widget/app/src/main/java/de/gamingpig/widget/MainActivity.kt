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
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
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

    private lateinit var bgDataBanner: LinearLayout
    private lateinit var btnAllowBgData: Button
    private lateinit var btnAllowBattery: Button

    private lateinit var previewBox: FrameLayout
    private lateinit var previewBgImage: ImageView
    private lateinit var previewAppLogo: ImageView
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

    private lateinit var btnShapeRounded: Button
    private lateinit var btnShapeCircle: Button
    private lateinit var btnShapeSquare: Button

    private lateinit var btnAccCyan: Button
    private lateinit var btnAccEmerald: Button
    private lateinit var btnAccPink: Button
    private lateinit var btnAccAmber: Button
    private lateinit var btnAccPurple: Button

    private lateinit var btnAlpha100: Button
    private lateinit var btnAlpha85: Button
    private lateinit var btnAlpha65: Button

    private lateinit var btnRadiusSharp: Button
    private lateinit var btnRadiusNormal: Button
    private lateinit var btnRadiusRound: Button

    private lateinit var switchProgress: Switch
    private lateinit var switchTimeline: Switch
    private lateinit var switchRecent: Switch
    private lateinit var switchTapSpotify: Switch
    private lateinit var switchLogo: Switch
    private lateinit var switchActions: Switch

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

        bgDataBanner = findViewById(R.id.bg_data_banner)
        btnAllowBgData = findViewById(R.id.btn_allow_bg_data)
        btnAllowBattery = findViewById(R.id.btn_allow_battery)

        findViewById<TextView>(R.id.txt_app_version).text =
            "v${UpdateChecker.getCurrentVersionName(this)} · Homescreen Live-Anzeige"

        previewBox = findViewById(R.id.preview_box)
        previewBgImage = findViewById(R.id.preview_bg_image)
        previewAppLogo = findViewById(R.id.preview_app_logo)
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

        btnShapeRounded = findViewById(R.id.btn_shape_rounded)
        btnShapeCircle = findViewById(R.id.btn_shape_circle)
        btnShapeSquare = findViewById(R.id.btn_shape_square)

        btnAccCyan = findViewById(R.id.btn_acc_cyan)
        btnAccEmerald = findViewById(R.id.btn_acc_emerald)
        btnAccPink = findViewById(R.id.btn_acc_pink)
        btnAccAmber = findViewById(R.id.btn_acc_amber)
        btnAccPurple = findViewById(R.id.btn_acc_purple)

        btnAlpha100 = findViewById(R.id.btn_alpha_100)
        btnAlpha85 = findViewById(R.id.btn_alpha_85)
        btnAlpha65 = findViewById(R.id.btn_alpha_65)

        btnRadiusSharp = findViewById(R.id.btn_radius_sharp)
        btnRadiusNormal = findViewById(R.id.btn_radius_normal)
        btnRadiusRound = findViewById(R.id.btn_radius_round)

        switchProgress = findViewById(R.id.switch_progress)
        switchTimeline = findViewById(R.id.switch_timeline)
        switchRecent = findViewById(R.id.switch_recent)
        switchTapSpotify = findViewById(R.id.switch_tap_spotify)
        switchLogo = findViewById(R.id.switch_logo)
        switchActions = findViewById(R.id.switch_actions)

        val btnPin = findViewById<Button>(R.id.btn_pin_widget)
        val txtHint = findViewById<TextView>(R.id.txt_pin_hint)

        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            btnPin.text = "✓ Speichern & Widget anwenden"
            txtHint.text = "Dein Widget auf dem Homescreen übernimmt sofort dieses Design."
        }

        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        switchProgress.isChecked = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_PROGRESS, true)
        switchTimeline.isChecked = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_TIMELINE, true)
        switchRecent.isChecked = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_RECENT, false)
        switchTapSpotify.isChecked = prefs.getBoolean(GamingpigWidgetProvider.KEY_TAP_OPENS_SPOTIFY, false)
        switchLogo.isChecked = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_LOGO, true)
        switchActions.isChecked = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_ACTIONS, true)

        applyAllPreviewSettings()

        btnAuto.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_THEME, "auto") }
        btnAmbientBlur.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_THEME, "ambient_blur") }
        btnAmbientColor.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_THEME, "ambient_color") }
        btnLiquid.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_THEME, "liquid") }
        btnLight.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_THEME, "light") }
        btnOled.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_THEME, "oled") }
        btnCyber.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_THEME, "cyber") }

        btnSizeSmall.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_TEXT_SIZE, "small") }
        btnSizeNormal.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_TEXT_SIZE, "normal") }
        btnSizeLarge.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_TEXT_SIZE, "large") }

        btnShapeRounded.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_COVER_SHAPE, "rounded") }
        btnShapeCircle.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_COVER_SHAPE, "circle") }
        btnShapeSquare.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_COVER_SHAPE, "square") }

        btnAccCyan.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_ACCENT_COLOR, "cyan") }
        btnAccEmerald.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_ACCENT_COLOR, "emerald") }
        btnAccPink.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_ACCENT_COLOR, "pink") }
        btnAccAmber.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_ACCENT_COLOR, "amber") }
        btnAccPurple.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_ACCENT_COLOR, "purple") }

        btnAlpha100.setOnClickListener { savePrefInt(GamingpigWidgetProvider.KEY_BG_ALPHA, 100) }
        btnAlpha85.setOnClickListener { savePrefInt(GamingpigWidgetProvider.KEY_BG_ALPHA, 85) }
        btnAlpha65.setOnClickListener { savePrefInt(GamingpigWidgetProvider.KEY_BG_ALPHA, 65) }

        btnRadiusSharp.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_CORNER_RADIUS, "sharp") }
        btnRadiusNormal.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_CORNER_RADIUS, "normal") }
        btnRadiusRound.setOnClickListener { savePrefString(GamingpigWidgetProvider.KEY_CORNER_RADIUS, "round") }

        btnAllowBgData.setOnClickListener { openBackgroundDataSettings() }
        btnAllowBattery.setOnClickListener { openBatteryOptimizationSettings() }

        switchProgress.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_PROGRESS, isChecked).apply()
            applyAllPreviewSettings()
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        switchTimeline.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_TIMELINE, isChecked).apply()
            applyAllPreviewSettings()
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        switchRecent.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_RECENT, isChecked).apply()
            applyAllPreviewSettings()
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        switchTapSpotify.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_TAP_OPENS_SPOTIFY, isChecked).apply()
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        switchLogo.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_LOGO, isChecked).apply()
            applyAllPreviewSettings()
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        switchActions.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_ACTIONS, isChecked).apply()
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
            checkForAppUpdate(userInitiated = false)
            GamingpigWidgetProvider.refreshAllWidgets(this, showSyncFeedback = true)
            Toast.makeText(this, "Live-Daten & Updates werden geprüft...", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.btn_open_web).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://gamingpig.github.io/about-qa/")))
        }

        findViewById<Button>(R.id.btn_check_updates).setOnClickListener {
            checkForAppUpdate(userInitiated = true)
        }

        requestNotificationPermissionIfNeeded()
        loadLivePreview()
        checkForAppUpdate(userInitiated = false)
    }

    override fun onResume() {
        super.onResume()
        updateSystemRestrictionBanner()
        mainHandler.removeCallbacks(previewTicker)
        mainHandler.postDelayed(previewTicker, 1000L)
    }

    private fun updateSystemRestrictionBanner() {
        val bgBlocked = GamingpigWidgetProvider.isBackgroundDataBlocked(this)
        val batteryIgnored = try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(packageName) ?: true
        } catch (_: Exception) {
            true
        }

        btnAllowBgData.visibility = if (bgBlocked) View.VISIBLE else View.GONE
        btnAllowBattery.visibility = if (!batteryIgnored) View.VISIBLE else View.GONE
        bgDataBanner.visibility = if (bgBlocked || !batteryIgnored) View.VISIBLE else View.GONE
    }

    private fun openBackgroundDataSettings() {
        try {
            startActivity(Intent(Settings.ACTION_IGNORE_BACKGROUND_DATA_RESTRICTIONS_SETTINGS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
            } catch (_: Exception) {
                Toast.makeText(this, "Bitte öffne App-Infos -> Mobile Daten -> Uneingeschränkte Datennutzung.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun openBatteryOptimizationSettings() {
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            } catch (_: Exception) {
                Toast.makeText(this, "Bitte deaktiviere die Akku-Optimierung in den App-Infos.", Toast.LENGTH_LONG).show()
            }
        }
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

    private fun checkForAppUpdate(userInitiated: Boolean = false) {
        val btnCheck = findViewById<Button>(R.id.btn_check_updates)
        if (userInitiated) {
            btnCheck.isEnabled = false
            btnCheck.text = "⏳ Suche nach Updates..."
        }
        executor.execute {
            val info = UpdateChecker.fetchUpdateInfo(this)
            runOnUiThread {
                btnCheck.isEnabled = true
                btnCheck.text = "🔄 Nach Updates suchen"
                if (info != null && info.isUpdateAvailable) {
                    updateBanner.visibility = View.VISIBLE
                    txtUpdateTitle.text = "🚀 Update v${info.versionName} verfügbar!"
                    txtUpdateNotes.text = info.notes
                    btnInstallUpdate.setOnClickListener {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(info.apkUrl)))
                    }
                    if (userInitiated) {
                        Toast.makeText(this, "🚀 Update v${info.versionName} verfügbar!", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    updateBanner.visibility = View.GONE
                    if (userInitiated) {
                        if (info != null) {
                            val curVer = UpdateChecker.getCurrentVersionName(this)
                            Toast.makeText(this, "✅ Du nutzt bereits die neueste Version (v$curVer)!", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(this, "⚠️ Update-Prüfung fehlgeschlagen. Internet prüfen.", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        }
    }

    private fun savePrefString(key: String, value: String) {
        getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(key, value).apply()
        applyAllPreviewSettings()
        GamingpigWidgetProvider.refreshAllWidgets(this)
    }

    private fun savePrefInt(key: String, value: Int) {
        getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putInt(key, value).apply()
        applyAllPreviewSettings()
        GamingpigWidgetProvider.refreshAllWidgets(this)
    }

    private fun applyAllPreviewSettings() {
        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val savedTheme = prefs.getString(GamingpigWidgetProvider.KEY_THEME, "auto") ?: "auto"
        val savedSize = prefs.getString(GamingpigWidgetProvider.KEY_TEXT_SIZE, "normal") ?: "normal"
        val coverShape = prefs.getString(GamingpigWidgetProvider.KEY_COVER_SHAPE, "rounded") ?: "rounded"
        val accentKey = prefs.getString(GamingpigWidgetProvider.KEY_ACCENT_COLOR, "cyan") ?: "cyan"
        val bgAlphaPct = prefs.getInt(GamingpigWidgetProvider.KEY_BG_ALPHA, 100)
        val cornerRadiusPref = prefs.getString(GamingpigWidgetProvider.KEY_CORNER_RADIUS, "normal") ?: "normal"
        val radiusPx = GamingpigWidgetProvider.resolveCornerRadiusPx(cornerRadiusPref)
        val showProgress = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_PROGRESS, true)
        val showRecent = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_RECENT, false)
        val showLogo = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_LOGO, true)

        val effectiveTheme = GamingpigWidgetProvider.resolveEffectiveTheme(this, savedTheme)
        val isLight = (effectiveTheme == "light")
        val snap = GamingpigWidgetProvider.lastSnapshot

        when {
            effectiveTheme == "ambient_blur" && snap?.blurredBgBitmap != null -> {
                val blurBmp = if (cornerRadiusPref != "normal") {
                    TrackDataFetcher.getRoundedCornerBitmap(snap.blurredBgBitmap, radiusPx)
                } else snap.blurredBgBitmap
                previewBox.setBackgroundResource(0)
                previewBgImage.visibility = View.VISIBLE
                previewBgImage.setImageBitmap(blurBmp)
                previewBgImage.imageAlpha = ((bgAlphaPct / 100f) * 255).toInt()
            }
            effectiveTheme == "ambient_color" && snap != null -> {
                previewBox.setBackgroundResource(0)
                previewBgImage.visibility = View.VISIBLE
                val bmp = Bitmap.createBitmap(240, 160, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                val alpha = ((bgAlphaPct / 100f) * Color.alpha(snap.dominantColor)).toInt()
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.argb(alpha, Color.red(snap.dominantColor), Color.green(snap.dominantColor), Color.blue(snap.dominantColor))
                }
                canvas.drawRoundRect(RectF(0f, 0f, 240f, 160f), radiusPx, radiusPx, paint)
                previewBgImage.setImageBitmap(bmp)
                previewBgImage.imageAlpha = 255
            }
            else -> {
                previewBgImage.visibility = View.GONE
                val baseColor = when (effectiveTheme) {
                    "light" -> Color.parseColor("#EEF2F6")
                    "oled" -> Color.parseColor("#000000")
                    "cyber" -> Color.parseColor("#1E1B4B")
                    else -> Color.parseColor("#0F172A")
                }
                val strokeColor = when (effectiveTheme) {
                    "light" -> Color.argb(45, 15, 23, 42)
                    "cyber" -> Color.argb(120, 56, 189, 248)
                    else -> Color.argb(65, 255, 255, 255)
                }
                val alpha = ((bgAlphaPct.coerceIn(20, 100) / 100f) * 255).toInt()
                val density = resources.displayMetrics.density
                val gd = GradientDrawable().apply {
                    setColor(Color.argb(alpha, Color.red(baseColor), Color.green(baseColor), Color.blue(baseColor)))
                    cornerRadius = radiusPx * density * 0.75f
                    setStroke((1.5f * density).toInt(), strokeColor)
                }
                previewBox.background = gd
            }
        }

        previewAppLogo.visibility = if (showLogo) View.VISIBLE else View.GONE

        val delta = when (savedSize) {
            "small" -> -2f
            "large" -> 2.5f
            else -> 0f
        }
        previewTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f + delta)
        previewArtist.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f + delta)
        previewRecent.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f + (delta * 0.5f))
        previewProgress.visibility = if (showProgress) View.VISIBLE else View.GONE

        val accentColorHex = GamingpigWidgetProvider.resolveAccentColorHex(accentKey, isLight)
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

        btnShapeRounded.backgroundTintList = if (coverShape == "rounded") activeTint else idleTint
        btnShapeCircle.backgroundTintList = if (coverShape == "circle") activeTint else idleTint
        btnShapeSquare.backgroundTintList = if (coverShape == "square") activeTint else idleTint

        btnAccCyan.backgroundTintList = if (accentKey == "cyan") activeTint else idleTint
        btnAccEmerald.backgroundTintList = if (accentKey == "emerald") activeTint else idleTint
        btnAccPink.backgroundTintList = if (accentKey == "pink") activeTint else idleTint
        btnAccAmber.backgroundTintList = if (accentKey == "amber") activeTint else idleTint
        btnAccPurple.backgroundTintList = if (accentKey == "purple") activeTint else idleTint

        btnAlpha100.backgroundTintList = if (bgAlphaPct == 100) activeTint else idleTint
        btnAlpha85.backgroundTintList = if (bgAlphaPct == 85) activeTint else idleTint
        btnAlpha65.backgroundTintList = if (bgAlphaPct == 65) activeTint else idleTint

        btnRadiusSharp.backgroundTintList = if (cornerRadiusPref == "sharp") activeTint else idleTint
        btnRadiusNormal.backgroundTintList = if (cornerRadiusPref == "normal") activeTint else idleTint
        btnRadiusRound.backgroundTintList = if (cornerRadiusPref == "round") activeTint else idleTint

        refreshPreviewFromSnapshot(accentColorHex, coverShape, showRecent)
    }

    private fun refreshPreviewFromSnapshot(accentColorHex: String, coverShape: String, showRecent: Boolean) {
        val snap = GamingpigWidgetProvider.lastSnapshot ?: return
        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val showTimeline = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_TIMELINE, true)
        val now = System.currentTimeMillis()

        previewTitle.text = snap.title
        previewArtist.text = snap.artist
        previewStatus.text = if (snap.isPlaying) "GAMINGPIG IS LISTENING TO" else "GAMINGPIG IS OFFLINE"
        previewStatus.setTextColor(Color.parseColor(if (snap.isPlaying) accentColorHex else "#94A3B8"))
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

        if (snap.rawArtBitmap != null) {
            previewCover.setImageBitmap(TrackDataFetcher.shapeCoverBitmap(snap.rawArtBitmap, coverShape))
        } else if (snap.artBitmap != null) {
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
                applyAllPreviewSettings()
            }
        }
    }
}
