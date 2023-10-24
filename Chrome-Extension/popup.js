async function getCurrentTab() {
  //get the current active tab of the browser
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Font size settings
const minFontSize = 12;
const maxFontSize = 36;
const increaseAmount = 2;
let fontSize = 16;

const CONTEXT_LENGTH_EXCEEDED = "context_length_exceeded"; //don't change
const TOKENS_LENGTH_EXCEEDED_MSG =
  "The video transcript is too long to generate a summary";
const ERROR_MSG = "Something went wrong, please try again later.";

document.addEventListener("DOMContentLoaded", async () => {
  let tab = await getCurrentTab();

  const summaryDiv = document.getElementById("summary");
  const summarizeBtn = document.getElementById("summarize-btn");
  // Font size interface
  const fontSizeLabel = document.getElementById("font-size-label");
  const increaseFontSizeBtn = document.getElementById("increase-font-size");
  const decreaseFontSizeBtn = document.getElementById("decrease-font-size");
  const loadingSpinner = document.getElementById("loading-spinner");
  const loadingMessage = document.getElementById("loading-message");

  //Outside youtube video's tabs
  if (!tab.url.includes("youtube.com/watch")) {
    summaryDiv.textContent =
      "You must be on a YouTube video to use this extension.";
    displaySummaryInterface();
    return;
  }

  increaseFontSizeBtn.addEventListener("click", () => {
    fontSize += increaseAmount; // You can adjust the step size as needed
    updateFontSize();
  });
  // Button to decrease font size
  decreaseFontSizeBtn.addEventListener("click", () => {
    fontSize -= increaseAmount; // You can adjust the step size as needed
    updateFontSize();
  });
  function updateFontSize() {
    // Function to update the font size in the summary container
    // Ensure the font size stays within the limits
    if (fontSize < minFontSize) {
      fontSize = minFontSize;
    } else if (fontSize > maxFontSize) {
      fontSize = maxFontSize;
    }
    summaryDiv.style.fontSize = `${fontSize}px`;
    fontSizeLabel.textContent = `Text Size: ${fontSize}px`;
  }
  function displaySummaryInterface() {
    fontSizeLabel.style.display = "inline-block";
    increaseFontSizeBtn.style.display = "inline-block";
    decreaseFontSizeBtn.style.display = "inline-block";
    summarizeBtn.style.display = "none";
    summaryDiv.style.display = "block";
    summarizeBtn.style.display = "none";
    summarizeBtn.disabled = true;
    loadingMessage.style.display = "none";
    loadingSpinner.style.display = "none";
  }

  //structure the video url
  const urlParameters = new URLSearchParams(tab.url.split("?")[1]);
  const videoId = urlParameters.get("v");

  // Load saved data on page load if it already exists
  chrome.storage.local.get([videoId], (result) => {
    if (result[videoId]) {
      summaryDiv.textContent = result[videoId].summary;
      displaySummaryInterface();
      updateFontSize(); // Update font size when displaying saved data
    }
  });

  async function getOpenAiErrorMessage(response) {
    // Function to return the error message based on the response from openai
    let responseData = {};
    let summary = "";
    responseData = await response.json();
    const summaryData = responseData.summary;
    switch (true) {
      case !!summaryData.NO_CAPTIONS_FOUND:
        summary = summaryData.NO_CAPTIONS_FOUND;
        break;
      case !!summaryData.RATE_LIMIT_EXCEEDED:
        summary = summaryData.RATE_LIMIT_EXCEEDED;
        break;
      case !!summaryData.PROMPT_TOO_LONG:
        summary = summaryData.PROMPT_TOO_LONG;
        break;
      case !!summaryData.error &&
        summaryData.error.code === CONTEXT_LENGTH_EXCEEDED:
        summary = TOKENS_LENGTH_EXCEEDED_MSG;
        break;
      default:
        summary = ERROR_MSG;
    }

    displaySummaryInterface();

    return summary;
  }
  function displayDefaultErrorMessage() {
    displaySummaryInterface();
    summaryDiv.textContent = ERROR_MSG;
  }
  //Get video's summary upon clicking the summarize button
  summarizeBtn.addEventListener("click", async () => {
    //Prepare interface for loading
    summarizeBtn.disabled = true;
    summarizeBtn.style.display = "none";
    loadingSpinner.style.display = "inline-block";
    loadingMessage.style.display = "block";

    const data = {
      videoId: videoId,
      title: tab.title,
    };

    try {
      //get summary from the server
      const response = await fetch(
        "https://chrome-extension-api-server.onrender.com/getSummary",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        displayDefaultErrorMessage();
      } else {
        if (
          //errors will be received as json
          response.headers.get("content-type") ===
          "application/json; charset=utf-8"
        ) {
          const errMsg = await getOpenAiErrorMessage(response);
          summaryDiv.textContent = errMsg;
        } else {
          //openai response will be received as chunks
          displaySummaryInterface();
          const reader = response.body.getReader();
          let result = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              //save summary to local storage
              chrome.storage.local.set({
                [videoId]: {
                  summary: result,
                },
              });
              break;
            }
            if (value) {
              // Process the received chunk
              result += new TextDecoder().decode(value);
              summaryDiv.textContent = result; // Update summaryDiv with the accumulated data
            }
          }
        }
      }
    } catch (error) {
      displayDefaultErrorMessage();
    }
  });

  //print local storage
  // chrome.storage.local.get(null, function (items) {
  //   for (const key in items) {
  //     console.log(key, items[key]);
  //   }
  // });
  //clear storage
  //chrome.storage.local.clear();
});
