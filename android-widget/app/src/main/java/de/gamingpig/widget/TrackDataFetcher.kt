package de.gamingpig.widget

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class RecentTrack(
    val title: String,
    val artist: String
)

data class TrackSnapshot(
    val isPlaying: Boolean,
    val title: String,
    val artist: String,
    val artUrl: String?,
    val artBitmap: Bitmap?,
    val blurredBgBitmap: Bitmap?,
    val dominantColor: Int,
    val progressMs: Long,
    val durationMs: Long,
    val recentTracks: List<RecentTrack>,
    val fetchedAtMs: Long = System.currentTimeMillis()
) {
    fun currentProgressMs(nowMs: Long = System.currentTimeMillis()): Long {
        if (!isPlaying || durationMs <= 0L) return progressMs.coerceAtLeast(0L)
        val elapsed = (nowMs - fetchedAtMs).coerceAtLeast(0L)
        return (progressMs + elapsed).coerceIn(0L, durationMs)
    }

    fun currentProgressPct(nowMs: Long = System.currentTimeMillis()): Int {
        if (!isPlaying || durationMs <= 0L) return 0
        return ((currentProgressMs(nowMs).toDouble() / durationMs.toDouble()) * 100.0).toInt().coerceIn(0, 100)
    }

    fun remainingMs(nowMs: Long = System.currentTimeMillis()): Long {
        if (!isPlaying || durationMs <= 0L) return Long.MAX_VALUE
        return (durationMs - currentProgressMs(nowMs)).coerceAtLeast(0L)
    }
}

object TrackDataFetcher {
    private const val NPC_URL = "https://npc-api.aikins.xyz/v1/users/gamingpig/now"
    private const val STATSFM_URL = "https://api.stats.fm/api/v1/users/gamingpig/streams/current"
    private const val STATSFM_RECENT_URL = "https://api.stats.fm/api/v1/users/gamingpig/streams/recent?limit=3"

    @Volatile private var cachedArtUrl: String? = null
    @Volatile private var cachedArtBitmap: Bitmap? = null
    @Volatile private var cachedBlurBitmap: Bitmap? = null
    @Volatile private var cachedDominantColor: Int = Color.parseColor("#0F172A")

    @Volatile private var cachedRecentTracks: List<RecentTrack> = emptyList()
    @Volatile private var lastRecentFetchMs: Long = 0L

    fun formatTime(ms: Long): String {
        if (ms <= 0L) return "0:00"
        val totalSec = ms / 1000L
        val min = totalSec / 60L
        val sec = totalSec % 60L
        return "$min:${if (sec < 10) "0$sec" else "$sec"}"
    }

    fun fetchCurrentTrack(includeRecent: Boolean = true): TrackSnapshot {
        var isPlaying = false
        var title = "Aktuell ist es ruhig..."
        var artist = "Gamingpig StandBy"
        var artUrl: String? = null
        var progressMs = 0L
        var durationMs = 0L

        // 1. Primary: stats.fm Live Current Stream
        try {
            val statsJson = fetchJson("$STATSFM_URL?t=${System.currentTimeMillis()}")
            val item = statsJson?.optJSONObject("item")
            if (item != null) {
                val trk = item.optJSONObject("track") ?: item
                val playingFlag = item.optBoolean("isPlaying", true)
                if (playingFlag) {
                    isPlaying = true
                    title = trk.optString("name", "").ifBlank { title }

                    val artistsArr = trk.optJSONArray("artists")
                    if (artistsArr != null && artistsArr.length() > 0) {
                        val names = mutableListOf<String>()
                        for (i in 0 until artistsArr.length()) {
                            val n = artistsArr.optJSONObject(i)?.optString("name", "")
                            if (!n.isNullOrBlank()) names.add(n)
                        }
                        if (names.isNotEmpty()) artist = names.joinToString(", ")
                    }

                    val albumsArr = trk.optJSONArray("albums")
                    if (albumsArr != null && albumsArr.length() > 0) {
                        artUrl = albumsArr.optJSONObject(0)?.optString("image", null)
                    }

                    durationMs = trk.optLong("durationMs", 0L)
                    val stream = item.optJSONObject("stream")
                    progressMs = if (item.has("progressMs")) {
                        item.optLong("progressMs", 0L)
                    } else {
                        stream?.optLong("progressMs", 0L) ?: 0L
                    }
                }
            }
        } catch (_: Exception) {
        }

        // 2. Fallback: NPC API
        if (!isPlaying) {
            try {
                val npcJson = fetchJson("$NPC_URL?t=${System.currentTimeMillis()}")
                val statusStr = npcJson?.optString("status", "") ?: ""
                val track = npcJson?.optJSONObject("track")
                if (track != null && (statusStr == "playing" || npcJson?.optBoolean("isPlaying", false) == true)) {
                    isPlaying = true
                    title = track.optString("title", "").ifBlank { title }
                    artist = track.optString("artist", "").ifBlank { artist }
                    if (artUrl.isNullOrBlank()) {
                        artUrl = track.optString("artwork_url", "").ifBlank { track.optString("art", null) }
                    }
                    durationMs = track.optLong("duration_ms", 0L)
                    progressMs = npcJson?.optLong("progress_ms", 0L) ?: 0L
                }
            } catch (_: Exception) {
            }
        }

        // 3. Recently Played (cached for 2 minutes to save battery & rate-limits)
        val now = System.currentTimeMillis()
        if (includeRecent && (cachedRecentTracks.isEmpty() || now - lastRecentFetchMs > 120_000L)) {
            val fetchedRecent = fetchRecentTracks()
            if (fetchedRecent.isNotEmpty()) {
                cachedRecentTracks = fetchedRecent
                lastRecentFetchMs = now
            }
        }

        // 4. Artwork + Zero-GPU Ambient Blur & Color (computed once per cover URL)
        var bitmap: Bitmap? = null
        var blurBitmap: Bitmap? = null
        var domColor = cachedDominantColor

        if (!artUrl.isNullOrBlank()) {
            if (artUrl == cachedArtUrl && cachedArtBitmap != null) {
                bitmap = cachedArtBitmap
                blurBitmap = cachedBlurBitmap
                domColor = cachedDominantColor
            } else {
                val raw = downloadRawBitmap(artUrl)
                if (raw != null) {
                    val scaled = Bitmap.createScaledBitmap(raw, 160, 160, true)
                    bitmap = getRoundedCornerBitmap(scaled, 26f)
                    domColor = extractAmbientColor(raw)
                    blurBitmap = createAmbientBlurBitmap(raw)

                    cachedArtUrl = artUrl
                    cachedArtBitmap = bitmap
                    cachedBlurBitmap = blurBitmap
                    cachedDominantColor = domColor
                }
            }
        }

        return TrackSnapshot(
            isPlaying = isPlaying,
            title = title,
            artist = artist,
            artUrl = artUrl,
            artBitmap = bitmap,
            blurredBgBitmap = blurBitmap,
            dominantColor = domColor,
            progressMs = progressMs,
            durationMs = durationMs,
            recentTracks = cachedRecentTracks,
            fetchedAtMs = System.currentTimeMillis()
        )
    }

    private fun fetchRecentTracks(): List<RecentTrack> {
        val list = mutableListOf<RecentTrack>()
        try {
            val json = fetchJson("$STATSFM_RECENT_URL&t=${System.currentTimeMillis()}") ?: return list
            val items = json.optJSONArray("items") ?: return list
            for (i in 0 until minOf(items.length(), 3)) {
                val trk = items.optJSONObject(i)?.optJSONObject("track") ?: continue
                val tName = trk.optString("name", "").trim()
                if (tName.isBlank()) continue
                val artistsArr = trk.optJSONArray("artists")
                val aName = if (artistsArr != null && artistsArr.length() > 0) {
                    artistsArr.optJSONObject(0)?.optString("name", "") ?: ""
                } else ""
                list.add(RecentTrack(tName, aName))
            }
        } catch (_: Exception) {
        }
        return list
    }

    private fun fetchJson(urlStr: String): JSONObject? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                connectTimeout = 5000
                readTimeout = 5000
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "GamingpigWidget/2.0 (Android)")
            }
            if (conn.responseCode == 200) {
                val text = conn.inputStream.bufferedReader().use { it.readText() }
                if (text.isNotBlank()) JSONObject(text) else null
            } else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun downloadRawBitmap(urlStr: String): Bitmap? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                connectTimeout = 5000
                readTimeout = 5000
                setRequestProperty("User-Agent", "GamingpigWidget/2.0 (Android)")
            }
            if (conn.responseCode == 200) {
                conn.inputStream.use { BitmapFactory.decodeStream(it) }
            } else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun extractAmbientColor(bitmap: Bitmap): Int {
        val tiny = Bitmap.createScaledBitmap(bitmap, 16, 16, true)
        var rSum = 0L
        var gSum = 0L
        var bSum = 0L
        var count = 0L
        for (y in 0 until 16) {
            for (x in 0 until 16) {
                val px = tiny.getPixel(x, y)
                val r = Color.red(px)
                val g = Color.green(px)
                val b = Color.blue(px)
                // Prefer colorful pixels over pure white/black
                val maxC = maxOf(r, g, b)
                val minC = minOf(r, g, b)
                val weight = if (maxC - minC > 25) 3L else 1L
                rSum += r * weight
                gSum += g * weight
                bSum += b * weight
                count += weight
            }
        }
        val rAvg = (rSum / maxOf(1L, count)).toInt().coerceIn(0, 255)
        val gAvg = (gSum / maxOf(1L, count)).toInt().coerceIn(0, 255)
        val bAvg = (bSum / maxOf(1L, count)).toInt().coerceIn(0, 255)

        // Darken cleanly (~42% brightness) so white text stays crisp and readable
        val rDark = (rAvg * 0.42f).toInt().coerceIn(10, 140)
        val gDark = (gAvg * 0.42f).toInt().coerceIn(10, 140)
        val bDark = (bAvg * 0.42f).toInt().coerceIn(15, 160)
        return Color.argb(235, rDark, gDark, bDark)
    }

    /**
     * Generates a 0% GPU runtime overhead static blurred cover background once per song change.
     */
    private fun createAmbientBlurBitmap(source: Bitmap): Bitmap {
        val w = 72
        val h = 72
        val small = Bitmap.createScaledBitmap(source, w, h, true)
        val blurred = fastBoxBlur(small, radius = 5)

        // Draw dark protective glass scrim + rounded corners onto 240x160 output
        val outW = 240
        val outH = 160
        val scaledUp = Bitmap.createScaledBitmap(blurred, outW, outH, true)
        val output = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val rect = Rect(0, 0, outW, outH)
        val rectF = RectF(rect)

        canvas.drawRoundRect(rectF, 26f, 26f, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(scaledUp, rect, rect, paint)

        // Subtle dark tint overlay for high text legibility
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)
        paint.color = Color.argb(138, 6, 10, 22)
        canvas.drawRoundRect(rectF, 26f, 26f, paint)

        // Crisp subtle border
        paint.xfermode = null
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2f
        paint.color = Color.argb(55, 255, 255, 255)
        canvas.drawRoundRect(RectF(1f, 1f, outW - 1f, outH - 1f), 26f, 26f, paint)

        return output
    }

    private fun fastBoxBlur(src: Bitmap, radius: Int): Bitmap {
        val w = src.width
        val h = src.height
        val pix = IntArray(w * h)
        src.getPixels(pix, 0, w, 0, 0, w, h)
        val tmp = IntArray(w * h)

        repeat(2) {
            // Horizontal pass
            for (y in 0 until h) {
                val rowOff = y * w
                for (x in 0 until w) {
                    var r = 0; var g = 0; var b = 0; var cnt = 0
                    for (dx in -radius..radius) {
                        val nx = (x + dx).coerceIn(0, w - 1)
                        val c = pix[rowOff + nx]
                        r += Color.red(c); g += Color.green(c); b += Color.blue(c)
                        cnt++
                    }
                    tmp[rowOff + x] = Color.rgb(r / cnt, g / cnt, b / cnt)
                }
            }
            // Vertical pass
            for (x in 0 until w) {
                for (y in 0 until h) {
                    var r = 0; var g = 0; var b = 0; var cnt = 0
                    for (dy in -radius..radius) {
                        val ny = (y + dy).coerceIn(0, h - 1)
                        val c = tmp[ny * w + x]
                        r += Color.red(c); g += Color.green(c); b += Color.blue(c)
                        cnt++
                    }
                    pix[y * w + x] = Color.rgb(r / cnt, g / cnt, b / cnt)
                }
            }
        }
        return Bitmap.createBitmap(pix, w, h, Bitmap.Config.ARGB_8888)
    }

    private fun getRoundedCornerBitmap(bitmap: Bitmap, pixels: Float): Bitmap {
        val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint().apply {
            isAntiAlias = true
            color = -0xbdbdbe
        }
        val rect = Rect(0, 0, bitmap.width, bitmap.height)
        val rectF = RectF(rect)
        canvas.drawARGB(0, 0, 0, 0)
        canvas.drawRoundRect(rectF, pixels, pixels, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(bitmap, rect, rect, paint)
        return output
    }
}
