/*
 * Material You NewTab
 * Copyright (c) 2023-2025 XengShi
 * Licensed under the GNU General Public License v3.0 (GPL-3.0)
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */

// Quote display elements
const quotesContainer = document.querySelector(".quotesContainer")
const authorName = document.querySelector(".authorName span")
const MAX_QUOTE_LENGTH = 140
let lastKnownLanguage = null

// Gemini API configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

// Get Gemini API key from localStorage
function getGeminiApiKey() {
  return localStorage.getItem("geminiApiKey")
}

// Generate quotes using Gemini API - Only Indian culture and Bhagavad Gita
async function generateGeminiQuotes(lang = "en") {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("Gemini API key not found")
  }

  try {
    const prompt =
      lang === "en"
        ? `Generate 25 inspirational quotes ONLY from Indian culture, Indian philosophers, Indian books, Bhagavad Gita, Upanishads, Vedas, Ramayana, Mahabharata, Indian saints like Swami Vivekananda, Rabindranath Tagore, Mahatma Gandhi, Chanakya, Kabir, Rumi, Guru Nanak, and other Indian spiritual leaders. Return as JSON array with format: [{"quote": "quote text", "author": "author name"}]. Keep quotes under 100 characters each. Only return the JSON array, no additional text.`
        : `Generate 25 inspirational quotes ONLY from Indian culture, Bhagavad Gita, Upanishads, Indian philosophers in ${lang} language. Return as JSON array with format: [{"quote": "quote text", "author": "author name"}]. Keep quotes under 100 characters each. Only return the JSON array, no additional text.`

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates[0].content.parts[0].text

    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const quotes = JSON.parse(jsonMatch[0])
      return quotes.filter((q) => q.quote && q.author)
    }

    // Fallback Indian quotes if parsing fails
    return getDefaultIndianQuotes()
  } catch (error) {
    console.error("Error generating Gemini quotes:", error)
    return getDefaultIndianQuotes()
  }
}

// Default Indian quotes fallback
function getDefaultIndianQuotes() {
  return [
    {
      quote: "You are what you believe in. You become that which you believe you can become.",
      author: "Bhagavad Gita",
    },
    {
      quote: "Change is the law of the universe. You can be a millionaire, or a pauper in an instant.",
      author: "Bhagavad Gita",
    },
    {
      quote: "The mind is everything. What you think you become.",
      author: "Buddha",
    },
    {
      quote: "Arise, awake, and stop not until the goal is reached.",
      author: "Swami Vivekananda",
    },
    {
      quote: "Be yourself; everyone else is already taken.",
      author: "Rabindranath Tagore",
    },
    {
      quote: "The best way to find yourself is to lose yourself in the service of others.",
      author: "Mahatma Gandhi",
    },
    {
      quote: "A person should not be too honest. Straight trees are cut first.",
      author: "Chanakya",
    },
    {
      quote: "Where there is love there is life.",
      author: "Mahatma Gandhi",
    },
  ]
}

// Clear all quotes-related data from localStorage
function clearQuotesStorage() {
  const keys = Object.keys(localStorage)
  keys.forEach((key) => {
    if (key.startsWith("quotes_")) {
      localStorage.removeItem(key)
    }
  })
  // Clear the quotes display
  quotesContainer.textContent = ""
  authorName.textContent = ""
}

// Check if quotes data needs to be refreshed
function shouldRefreshQuotes(lang, quotesData) {
  // Check if quotes data exists and is an array
  if (!quotesData || !Array.isArray(quotesData) || quotesData.length === 0) {
    return true
  }

  // Check if we have stored timestamp for this language
  const storedTimestamp = localStorage.getItem(`quotes_${lang}_timestamp`)
  if (!storedTimestamp) {
    return true
  }

  // Time-based validation - refresh every 6 hours for Gemini quotes
  const now = Date.now()
  const timeDiff = now - new Date(storedTimestamp).getTime()
  const sixHours = 6 * 60 * 60 * 1000

  if (timeDiff > sixHours) {
    return true
  }

  return false
}

// Fetch quotes for a specific language and store them locally
async function fetchQuotes(lang) {
  try {
    const quotes = await generateGeminiQuotes(lang)

    // Store quotes and timestamp in localStorage
    localStorage.setItem(`quotes_${lang}`, JSON.stringify(quotes))
    localStorage.setItem(`quotes_${lang}_timestamp`, new Date().toISOString())

    // Store the quote count for this language
    localStorage.setItem(`quotes_${lang}_count`, quotes.length.toString())

    return quotes
  } catch (error) {
    console.error(`Error fetching quotes for ${lang}:`, error)
    throw error
  }
}

// Get quotes for the current language
async function getQuotesForLanguage(forceRefresh = false) {
  try {
    // Check if language has changed
    const languageChanged = lastKnownLanguage !== null && lastKnownLanguage !== currentLanguage
    if (languageChanged) {
      forceRefresh = true
    }

    // Update last known language
    lastKnownLanguage = currentLanguage
    const targetLang = currentLanguage
    let quotesData = null

    // If language changed, clear old data for the previous language
    if (languageChanged) {
      clearQuotesStorage()
    }

    // Try to get stored quotes first
    const storedQuotes = localStorage.getItem(`quotes_${targetLang}`)
    if (storedQuotes) {
      quotesData = JSON.parse(storedQuotes)
    }

    // Check if we need to fetch new quotes (only when online and API key available)
    if (navigator.onLine && getGeminiApiKey() && (forceRefresh || shouldRefreshQuotes(targetLang, quotesData))) {
      quotesData = await fetchQuotes(targetLang)
      // Clear other language data after successfully fetching new data
      if (!languageChanged) {
        const keys = Object.keys(localStorage)
        keys.forEach((key) => {
          if (key.startsWith("quotes_") && !key.includes(targetLang)) {
            localStorage.removeItem(key)
          }
        })
      }
    }

    // If no quotes available, return default Indian quotes
    if (!quotesData || quotesData.length === 0) {
      quotesData = getDefaultIndianQuotes()
    }

    return quotesData
  } catch (error) {
    console.error("Error getting quotes:", error)
    // Return default Indian quotes if everything fails
    return getDefaultIndianQuotes()
  }
}

// Display a random quote that meets the length requirements
function displayRandomQuote(quotes) {
  if (!quotes || quotes.length === 0) {
    quotesContainer.textContent = "You are what you believe in. You become that which you believe you can become."
    authorName.textContent = "Bhagavad Gita"
    return
  }

  let selectedQuote
  const maxAttempts = 15 // Prevent infinite loop

  // Try to find a quote that fits within the character limit
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const randomIndex = Math.floor(Math.random() * quotes.length)
    selectedQuote = quotes[randomIndex]
    const totalLength = selectedQuote.quote.length + selectedQuote.author.length
    if (totalLength <= MAX_QUOTE_LENGTH) {
      break
    }
  }

  // Display the selected quote
  quotesContainer.textContent = selectedQuote.quote
  authorName.textContent = selectedQuote.author
}

// Main function to load and display a quote
async function loadAndDisplayQuote(forceRefresh = false) {
  try {
    const quotes = await getQuotesForLanguage(forceRefresh)
    displayRandomQuote(quotes)
  } catch (error) {
    console.error("Error loading quote:", error)
    // Display fallback Indian quote on any error
    quotesContainer.textContent = "You are what you believe in. You become that which you believe you can become."
    authorName.textContent = "Bhagavad Gita"
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const hideSearchWith = document.getElementById("shortcut_switchcheckbox")
  const quotesToggle = document.getElementById("quotesToggle")
  const motivationalQuotesCont = document.getElementById("motivationalQuotesCont")
  const motivationalQuotesCheckbox = document.getElementById("motivationalQuotesCheckbox")
  const searchWithContainer = document.getElementById("search-with-container")

  // Gemini API key elements
  const geminiApiKeyInput = document.getElementById("geminiApiKey")
  const saveGeminiKeyButton = document.getElementById("saveGeminiKey")

  // Load states from localStorage
  hideSearchWith.checked = localStorage.getItem("showShortcutSwitch") === "true"
  motivationalQuotesCheckbox.checked = localStorage.getItem("motivationalQuotesVisible") !== "false"

  // Load Gemini API key
  const savedApiKey = getGeminiApiKey()
  if (savedApiKey && geminiApiKeyInput) {
    geminiApiKeyInput.value = savedApiKey
  }

  // Initialize language tracking
  lastKnownLanguage = currentLanguage

  // Function to update quotes visibility and handle state changes
  const updateMotivationalQuotesState = () => {
    const isHideSearchWithEnabled = hideSearchWith.checked
    const isMotivationalQuotesEnabled = motivationalQuotesCheckbox.checked

    // Save state to localStorage
    localStorage.setItem("motivationalQuotesVisible", isMotivationalQuotesEnabled)

    // Handle visibility based on settings
    if (!isHideSearchWithEnabled) {
      quotesToggle.classList.add("inactive")
      motivationalQuotesCont.style.display = "none"
      clearQuotesStorage()
      return
    }

    // Update UI visibility
    quotesToggle.classList.remove("inactive")
    searchWithContainer.style.display = isMotivationalQuotesEnabled ? "none" : "flex"
    motivationalQuotesCont.style.display = isMotivationalQuotesEnabled ? "flex" : "none"

    // Load quotes if motivational quotes are enabled
    if (isMotivationalQuotesEnabled) {
      loadAndDisplayQuote(false)
    } else {
      clearQuotesStorage()
    }
  }

  // Apply initial state
  updateMotivationalQuotesState()

  // Event Listeners
  hideSearchWith.addEventListener("change", () => {
    searchWithContainer.style.display = "flex"
    updateMotivationalQuotesState()
  })

  motivationalQuotesCheckbox.addEventListener("change", updateMotivationalQuotesState)

  // Gemini API key save functionality
  if (saveGeminiKeyButton && geminiApiKeyInput) {
    saveGeminiKeyButton.addEventListener("click", () => {
      const apiKey = geminiApiKeyInput.value.trim()
      if (apiKey) {
        localStorage.setItem("geminiApiKey", apiKey)
        // Clear existing quotes to force refresh with new API key
        clearQuotesStorage()
        // Reload quotes if they are currently visible
        if (motivationalQuotesCheckbox.checked) {
          loadAndDisplayQuote(true)
        }
        alert("Gemini API key saved successfully!")
      } else {
        alert("Please enter a valid API key")
      }
    })
  }
})
