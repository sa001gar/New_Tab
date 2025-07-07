/*
 * Material You NewTab - Spotify Integration (Production)
 * Copyright (c) 2023-2025 XengShi
 * Licensed under the GNU General Public License v3.0 (GPL-3.0)
 */

// Spotify API configuration
let spotifyAccessToken = null
let spotifyTokenExpiry = null
let spotifyUpdateInterval = null
let currentTrackData = null
let localProgress = 0
let localProgressInterval = null
let isPlaying = false

// Get Spotify credentials from localStorage
function getSpotifyCredentials() {
  return {
    clientId: localStorage.getItem("spotifyClientId"),
    clientSecret: localStorage.getItem("spotifyClientSecret"),
    refreshToken: localStorage.getItem("spotifyRefreshToken"),
  }
}

// Get new access token using refresh token
async function refreshSpotifyToken() {
  const credentials = getSpotifyCredentials()

  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    console.log("Spotify credentials not found")
    return false
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(credentials.clientId + ":" + credentials.clientSecret),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      spotifyAccessToken = data.access_token
      spotifyTokenExpiry = Date.now() + data.expires_in * 1000
      return true
    } else {
      console.error("Failed to refresh Spotify token:", response.status)
      return false
    }
  } catch (error) {
    console.error("Error refreshing Spotify token:", error)
    return false
  }
}

// Get currently playing track
async function getCurrentlyPlaying() {
  if (!spotifyAccessToken || Date.now() >= spotifyTokenExpiry) {
    const tokenRefreshed = await refreshSpotifyToken()
    if (!tokenRefreshed) {
      return null
    }
  }

  try {
    const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: {
        Authorization: "Bearer " + spotifyAccessToken,
      },
    })

    if (response.status === 204) {
      return null // No song playing
    }

    if (response.ok) {
      const data = await response.json()
      return data
    } else {
      console.error("Failed to get currently playing:", response.status)
      return null
    }
  } catch (error) {
    console.error("Error getting currently playing:", error)
    return null
  }
}

// Format time from milliseconds to MM:SS
function formatTime(ms) {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

// Start local progress counter
function startLocalProgress() {
  if (localProgressInterval) {
    clearInterval(localProgressInterval)
  }

  if (isPlaying && currentTrackData) {
    localProgressInterval = setInterval(() => {
      localProgress += 1000 // Add 1 second

      if (localProgress >= currentTrackData.item.duration_ms) {
        localProgress = currentTrackData.item.duration_ms
        stopLocalProgress()
        return
      }

      updateProgressDisplay()
    }, 1000)
  }
}

// Stop local progress counter
function stopLocalProgress() {
  if (localProgressInterval) {
    clearInterval(localProgressInterval)
    localProgressInterval = null
  }
}

// Update progress display
function updateProgressDisplay() {
  if (!currentTrackData) return

  const duration = currentTrackData.item.duration_ms
  const progressPercent = (localProgress / duration) * 100

  document.getElementById("currentTime").textContent = formatTime(localProgress)
  document.getElementById("totalTime").textContent = formatTime(duration)
  document.getElementById("progressFill").style.width = Math.min(progressPercent, 100) + "%"
}

// Show/hide widget based on playback state
function updateWidgetVisibility(hasTrack) {
  const spotifyWidget = document.getElementById("spotifyWidget")
  const spotifyWidgetCheckbox = document.getElementById("spotifyWidgetCheckbox")

  if (hasTrack && spotifyWidgetCheckbox && spotifyWidgetCheckbox.checked) {
    spotifyWidget.style.display = "block"
  } else {
    spotifyWidget.style.display = "none"
  }
}

// Update Spotify widget display
async function updateSpotifyWidget() {
  const currentTrack = await getCurrentlyPlaying()

  if (!currentTrack || !currentTrack.item) {
    // No song playing - hide widget
    updateWidgetVisibility(false)
    currentTrackData = null
    isPlaying = false
    stopLocalProgress()
    return
  }

  const track = currentTrack.item
  const progress = currentTrack.progress_ms
  const wasPlaying = isPlaying
  isPlaying = currentTrack.is_playing

  // Update track info
  document.getElementById("songTitle").textContent = track.name
  document.getElementById("artistName").textContent = track.artists.map((artist) => artist.name).join(", ")
//   document.getElementById("albumName").textContent = track.album.name

  // Update album art
  const albumImage = document.getElementById("albumImage")
  if (track.album.images && track.album.images.length > 0) {
    albumImage.src = track.album.images[0].url
  } else {
    albumImage.src = "/placeholder.svg?height=48&width=48"
  }

  // Sync local progress with server progress
  localProgress = progress
  currentTrackData = currentTrack

  // Update progress display
  updateProgressDisplay()

  // Show widget since we have a track
  updateWidgetVisibility(true)

  // Handle play state changes
  if (isPlaying && !wasPlaying) {
    startLocalProgress()
  } else if (!isPlaying && wasPlaying) {
    stopLocalProgress()
  }
}

// Start Spotify updates
function startSpotifyUpdates() {
  if (spotifyUpdateInterval) {
    clearInterval(spotifyUpdateInterval)
  }

  // Update immediately
  updateSpotifyWidget()

  // Update every 10 seconds (server sync)
  spotifyUpdateInterval = setInterval(updateSpotifyWidget, 10000)
}

// Stop Spotify updates
function stopSpotifyUpdates() {
  if (spotifyUpdateInterval) {
    clearInterval(spotifyUpdateInterval)
    spotifyUpdateInterval = null
  }
  stopLocalProgress()

  // Hide widget when stopped
  const spotifyWidget = document.getElementById("spotifyWidget")
  if (spotifyWidget) {
    spotifyWidget.style.display = "none"
  }
}

// Initialize Spotify integration
document.addEventListener("DOMContentLoaded", () => {
  const spotifyWidgetCheckbox = document.getElementById("spotifyWidgetCheckbox")
  const spotifyWidget = document.getElementById("spotifyWidget")
  const saveSpotifyKeysButton = document.getElementById("saveSpotifyKeys")

  // Load saved credentials
  const credentials = getSpotifyCredentials()
  if (credentials.clientId && document.getElementById("spotifyClientId")) {
    document.getElementById("spotifyClientId").value = credentials.clientId
  }
  if (credentials.clientSecret && document.getElementById("spotifyClientSecret")) {
    document.getElementById("spotifyClientSecret").value = credentials.clientSecret
  }
  if (credentials.refreshToken && document.getElementById("spotifyRefreshToken")) {
    document.getElementById("spotifyRefreshToken").value = credentials.refreshToken
  }

  // Load widget visibility state
  const isSpotifyVisible = localStorage.getItem("spotifyWidgetVisible") !== "false"
  if (spotifyWidgetCheckbox) {
    spotifyWidgetCheckbox.checked = isSpotifyVisible
  }

  // Start updates if enabled and credentials exist
  if (isSpotifyVisible && credentials.clientId && credentials.clientSecret && credentials.refreshToken) {
    startSpotifyUpdates()
  }

  // Handle widget toggle
  if (spotifyWidgetCheckbox) {
    spotifyWidgetCheckbox.addEventListener("change", () => {
      const isVisible = spotifyWidgetCheckbox.checked
      localStorage.setItem("spotifyWidgetVisible", isVisible)

      if (isVisible) {
        const creds = getSpotifyCredentials()
        if (creds.clientId && creds.clientSecret && creds.refreshToken) {
          startSpotifyUpdates()
        } else {
          alert("Please configure your Spotify API credentials first.")
          spotifyWidgetCheckbox.checked = false
        }
      } else {
        stopSpotifyUpdates()
      }
    })
  }

  // Handle save credentials
  if (saveSpotifyKeysButton) {
    saveSpotifyKeysButton.addEventListener("click", () => {
      const clientId = document.getElementById("spotifyClientId")?.value.trim()
      const clientSecret = document.getElementById("spotifyClientSecret")?.value.trim()
      const refreshToken = document.getElementById("spotifyRefreshToken")?.value.trim()

      if (clientId && clientSecret && refreshToken) {
        localStorage.setItem("spotifyClientId", clientId)
        localStorage.setItem("spotifyClientSecret", clientSecret)
        localStorage.setItem("spotifyRefreshToken", refreshToken)

        // Reset token to force refresh
        spotifyAccessToken = null
        spotifyTokenExpiry = null

        if (spotifyWidgetCheckbox && spotifyWidgetCheckbox.checked) {
          startSpotifyUpdates()
        }

        alert("Spotify credentials saved successfully!")
      } else {
        alert("Please fill in all Spotify credentials")
      }
    })
  }
})
