package de.gamingpig.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
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

    private lateinit var previewBox: LinearLayout
    private lateinit var previewCover: ImageView
    private lateinit var previewTitle: TextView
    private lateinit var previewArtist: TextView
    private lateinit var previewStatus: TextView
    private lateinit var previewProgress: ProgressBar

    private lateinit var btnLiquid: Button
    private lateinit var btnOled: Button
    private lateinit var btnCyber: Button
    private lateinit var switchProgress: Switch

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        previewBox = findViewById(R.id.preview_box)
        previewCover = findViewById(R.id.preview_cover)
        previewTitle = findViewById(R.id.preview_title)
        previewArtist = findViewById(R.id.preview_artist)
        previewStatus = findViewById(R.id.preview_status)
        previewProgress = findViewById(R.id.preview_progress)

        btnLiquid = findViewById(R.id.btn_theme_liquid)
        btnOled = findViewById(R.id.btn_theme_oled)
        btnCyber = findViewById(R.id.btn_theme_cyber)
        switchProgress = findViewById(R.id.switch_progress)

        val btnPin = findViewById<Button>(R.id.btn_pin_widget)
        val txtHint = findViewById<TextView>(R.id.txt_pin_hint)

        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            btnPin.text = "✓ Speichern & Widget anwenden"
            txtHint.text = "Dein Widget auf dem Homescreen übernimmt sofort dieses Design."
        }

        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val savedTheme = prefs.getString(GamingpigWidgetProvider.KEY_THEME, "liquid") ?: "liquid"
        val savedProgress = prefs.getBoolean(GamingpigWidgetProvider.KEY_SHOW_PROGRESS, true)

        switchProgress.isChecked = savedProgress
        applyPreviewTheme(savedTheme, savedProgress)

        btnLiquid.setOnClickListener { saveAndApplyTheme("liquid") }
        btnOled.setOnClickListener { saveAndApplyTheme("oled") }
        btnCyber.setOnClickListener { saveAndApplyTheme("cyber") }

        switchProgress.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(GamingpigWidgetProvider.KEY_SHOW_PROGRESS, isChecked).apply()
            previewProgress.visibility = if (isChecked) View.VISIBLE else View.GONE
            GamingpigWidgetProvider.refreshAllWidgets(this)
        }

        btnPin.setOnClickListener {
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
            GamingpigWidgetProvider.refreshAllWidgets(this)
            Toast.makeText(this, "Live-Daten aktualisiert!", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.btn_open_web).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://gamingpig.github.io/about-qa/?mode=widget")))
        }

        loadLivePreview()
    }

    private fun saveAndApplyTheme(theme: String) {
        val prefs = getSharedPreferences(GamingpigWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(GamingpigWidgetProvider.KEY_THEME, theme).apply()
        applyPreviewTheme(theme, switchProgress.isChecked)
        GamingpigWidgetProvider.refreshAllWidgets(this)
    }

    private fun applyPreviewTheme(theme: String, showProgress: Boolean) {
        val bgRes = when (theme) {
            "oled" -> R.drawable.widget_bg_oled
            "cyber" -> R.drawable.widget_bg_cyber
            else -> R.drawable.widget_bg_liquid
        }
        previewBox.setBackgroundResource(bgRes)
        previewProgress.visibility = if (showProgress) View.VISIBLE else View.GONE

        val activeTint = ColorStateList.valueOf(Color.parseColor("#0284C7"))
        val idleTint = ColorStateList.valueOf(Color.parseColor("#1E293B"))

        btnLiquid.backgroundTintList = if (theme == "liquid") activeTint else idleTint
        btnOled.backgroundTintList = if (theme == "oled") activeTint else idleTint
        btnCyber.backgroundTintList = if (theme == "cyber") activeTint else idleTint
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
            runOnUiThread {
                previewTitle.text = snap.title
                previewArtist.text = snap.artist
                previewStatus.text = if (snap.isPlaying) "NOW PLAYING" else "STANDBY"
                previewStatus.setTextColor(Color.parseColor(if (snap.isPlaying) "#34D399" else "#94A3B8"))
                previewProgress.progress = snap.progressPct
                if (snap.artBitmap != null) {
                    previewCover.setImageBitmap(snap.artBitmap)
                }
            }
        }
    }
}
