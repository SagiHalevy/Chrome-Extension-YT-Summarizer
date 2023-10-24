require("dotenv").config();

const apiKeyOpenAI = process.env.OPENAI_API_KEY;
const MAX_PROMPT_TOKENS = 3700;
const NO_EN_CAPTION_FOUND_MSG =
  "Sorry, the video must contain english captions in order to generate a summary.";
const PROMPT_TOO_LONG_MSG =
  "The video transcript is too long to generate a summary";
("Sorry, the video must contain english captions in order to generate a summary.");
const OpenAI = require("openai");
const openai = new OpenAI(apiKeyOpenAI);

async function getSummary(req, res) {
  function approxTokensCost(text) {
    // calculate the approx cost of tokens
    const words = text.split(/\s+/);

    const wordsCount = words.length;

    const approxTokens = wordsCount / 0.75;
    return approxTokens || 0;
  }
  function extractCaptionsFromXML(xmlData) {
    // Function to extract only the captions from XML file
    const startTag = "<text";
    const endTag = "</text>";
    const captions = [];
    let currentIndex = xmlData.indexOf(startTag);

    while (currentIndex !== -1) {
      const startIndex = xmlData.indexOf(">", currentIndex);
      const endIndex = xmlData.indexOf(endTag, startIndex);
      if (startIndex !== -1 && endIndex !== -1) {
        const caption = xmlData.substring(startIndex + 1, endIndex);
        captions.push(caption);
        currentIndex = xmlData.indexOf(startTag, endIndex);
      } else {
        currentIndex = -1;
      }
    }

    return captions;
  }

  async function getCaptions(videoUrl) {
    try {
      const videoInfo = await fetch(videoUrl);
      const text = await videoInfo.text();
      const match = text.match(/"captionTracks":\s*(\[.*?\])/);

      if (!match) {
        return -1; //"No caption tracks found in the response."
      }

      const captionTracks = JSON.parse(match[1]);

      if (captionTracks.length === 0) {
        return -1; //"No caption tracks found."
      }

      const firstEnglishCaptionTrack = captionTracks.find(
        (track) => track.languageCode === "en"
      );

      if (!firstEnglishCaptionTrack) {
        return -1; //"No English caption track found."
      }

      const captionsBaseURL = firstEnglishCaptionTrack.baseUrl;
      const fetchedCaptions = await fetch(captionsBaseURL);
      const captionsText = await fetchedCaptions.text();

      const captions = extractCaptionsFromXML(captionsText).join(" ");
      return captions;
    } catch (err) {
      return -1;
    }
  }

  async function streamOpenAiResponse(prompt) {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }],
      stream: true,
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0].delta.content;
      if (content) {
        res.write(content);
      }
    }
    res.end();
  }

  function sendErrorMessage(res, error) {
    res.setHeader("Content-Type", "application/json");
    const summary = error;
    res.json({ summary });
  }

  const videoId = req.body.videoId;
  const title = req.body.title;
  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;

  let captions = await getCaptions(videoURL);

  if (captions === -1) {
    sendErrorMessage(res, { NO_CAPTIONS_FOUND: NO_EN_CAPTION_FOUND_MSG });
    return;
  }

  if (approxTokensCost(captions) > MAX_PROMPT_TOKENS) {
    // check if the prompt is too long before sending to openai,
    // if the prompt is short but openai response is too long, another error will be thrown from openai

    sendErrorMessage(res, { PROMPT_TOO_LONG: PROMPT_TOO_LONG_MSG });

    return;
  }

  let prompt =
    "Please summarize the video, rely strictly on the provided transcript, without including external information. Video Title: " +
    title +
    ". " +
    "Transcript of the video: " +
    captions;
  try {
    await streamOpenAiResponse(prompt);
  } catch (err) {
    sendErrorMessage(res, err);
  }
}

module.exports = {
  getSummary,
};
