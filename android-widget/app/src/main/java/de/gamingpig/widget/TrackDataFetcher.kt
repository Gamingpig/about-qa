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
import java.net.URLEncoder

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

    @Volatile private var cachedTrackKey: String? = null
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
        var statsFmArtUrl: String? = null
        var spotifyId: String? = null
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

                    val extIds = trk.optJSONObject("externalIds")
                    val spArr = extIds?.optJSONArray("spotify")
                    if (spArr != null && spArr.length() > 0) {
                        spotifyId = spArr.optString(0, "").replace("spotify:track:", "").trim().ifBlank { null }
                    }

                    val albumsArr = trk.optJSONArray("albums")
                    if (albumsArr != null && albumsArr.length() > 0) {
                        statsFmArtUrl = albumsArr.optJSONObject(0)?.optString("image", null)
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
        var npcArtUrl: String? = null
        if (!isPlaying) {
            try {
                val npcJson = fetchJson("$NPC_URL?t=${System.currentTimeMillis()}")
                val statusStr = npcJson?.optString("status", "") ?: ""
                val track = npcJson?.optJSONObject("track")
                if (track != null && (statusStr == "playing" || npcJson?.optBoolean("isPlaying", false) == true)) {
                    isPlaying = true
                    title = track.optString("title", "").ifBlank { title }
                    artist = track.optString("artist", "").ifBlank { artist }
                    npcArtUrl = track.optString("artwork_url", "").ifBlank { track.optString("art", null) }
                    if (spotifyId.isNullOrBlank()) {
                        val spUri = track.optString("spotify_id", "").ifBlank { track.optString("track_id", "") }
                        if (spUri.isNotBlank()) spotifyId = spUri.replace("spotify:track:", "").trim()
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

        // 4. Authentic Cover Resolution (Keyed by exact track ID so wrong/stale covers never stick)
        var bitmap: Bitmap? = null
        var blurBitmap: Bitmap? = null
        var domColor = Color.parseColor("#0F172A")
        var resolvedArtUrl: String? = null

        if (isPlaying) {
            val trackKey = spotifyId ?: "$title|$artist"
            if (trackKey == cachedTrackKey && cachedArtBitmap != null) {
                resolvedArtUrl = cachedArtUrl
                bitmap = cachedArtBitmap
                blurBitmap = cachedBlurBitmap
                domColor = cachedDominantColor
            } else {
                // Priority 1: Exact Spotify oEmbed (always matches the exact Spotify track!)
                if (!spotifyId.isNullOrBlank()) {
                    resolvedArtUrl = fetchSpotifyOembedCover(spotifyId)
                }
                // Priority 2: NPC API artwork_url or stats.fm album image
                if (resolvedArtUrl.isNullOrBlank()) {
                    resolvedArtUrl = npcArtUrl?.takeIf { it.isNotBlank() } ?: statsFmArtUrl
                }
                // Priority 3: iTunes Search fallback
                if (resolvedArtUrl.isNullOrBlank()) {
                    resolvedArtUrl = fetchItunesFallbackCover(title, artist)
                }

                val raw = if (!resolvedArtUrl.isNullOrBlank()) downloadRawBitmap(resolvedArtUrl) else null
                if (raw != null) {
                    val scaled = Bitmap.createScaledBitmap(raw, 160, 160, true)
                    bitmap = getRoundedCornerBitmap(scaled, 26f)
                    domColor = extractAmbientColor(raw)
                    blurBitmap = createAmbientBlurBitmap(raw)

                    cachedTrackKey = trackKey
                    cachedArtUrl = resolvedArtUrl
                    cachedArtBitmap = bitmap
                    cachedBlurBitmap = blurBitmap
                    cachedDominantColor = domColor
                } else {
                    cachedTrackKey = null
                    cachedArtUrl = null
                    cachedArtBitmap = null
                    cachedBlurBitmap = null
                }
            }
        }

        return TrackSnapshot(
            isPlaying = isPlaying,
            title = title,
            artist = artist,
            artUrl = resolvedArtUrl,
            artBitmap = bitmap,
            blurredBgBitmap = blurBitmap,
            dominantColor = domColor,
            progressMs = progressMs,
            durationMs = durationMs,
            recentTracks = cachedRecentTracks,
            fetchedAtMs = System.currentTimeMillis()
        )
    }

    private fun fetchSpotifyOembedCover(spotifyTrackId: String): String? {
        return try {
            val trackUrl = URLEncoder.encode("https://open.spotify.com/track/$spotifyTrackId", "UTF-8")
            val json = fetchJson("https://open.spotify.com/oembed?url=$trackUrl")
            json?.optString("thumbnail_url", "")?.takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }

    private fun fetchItunesFallbackCover(title: String, artist: String): String? {
        return try {
            val cleanArtist = artist.split(",")[0].trim()
            val q = URLEncoder.encode("$cleanArtist $title", "UTF-8")
            val json = fetchJson("https://itunes.apple.com/search?term=$q&media=music&entity=song&limit=3")
            val results = json?.optJSONArray("results")
            if (results != null && results.length() > 0) {
                val url100 = results.optJSONObject(0)?.optString("artworkUrl100", "")
                if (!url100.isNullOrBlank()) url100.replace("100x100bb", "600x600bb") else null
            } else null
        } catch (_: Exception) {
            null
        }
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
                setRequestProperty("User-Agent", "GamingpigWidget/2.0.1 (Android)")
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
                setRequestProperty("User-Agent", "GamingpigWidget/2.0.1 (Android)")
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

        val rDark = (rAvg * 0.42f).toInt().coerceIn(10, 140)
        val gDark = (gAvg * 0.42f).toInt().coerceIn(10, 140)
        val bDark = (bAvg * 0.42f).toInt().coerceIn(15, 160)
        return Color.argb(235, rDark, gDark, bDark)
    }

    private fun createAmbientBlurBitmap(source: Bitmap): Bitmap {
        val w = 72
        val h = 72
        val small = Bitmap.createScaledBitmap(source, w, h, true)
        val blurred = fastBoxBlur(small, radius = 5)

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

        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)
        paint.color = Color.argb(138, 6, 10, 22)
        canvas.drawRoundRect(rectF, 26f, 26f, paint)

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
