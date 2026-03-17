import axios from "axios";
import cheerio from "cheerio";
import fs from "fs";

function extractTemps(elements) {
  return elements.map(el => {
    const match = el.match(/-?\d+/);
    return match ? parseInt(match[0]) : null;
  }).slice(0, 3);
}

async function fetchPage(url) {
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return cheerio.load(data);
}

// METEOBLUE (most reliable)
async function getMeteoblue() {
  const $ = await fetchPage(
    "https://www.meteoblue.com/en/weather/week/london-united-kingdom"
  );

  const temps = [];
  $(".tab-temp-max").each((i, el) => {
    temps.push($(el).text());
  });

  return extractTemps(temps);
}

// ACCUWEATHER
async function getAccuWeather() {
  const $ = await fetchPage(
    "https://www.accuweather.com/en/gb/london/ec4a-2/weather-forecast/328328"
  );

  const temps = [];
  $(".temp").each((i, el) => {
    temps.push($(el).text());
  });

  return extractTemps(temps);
}

// WUNDERGROUND (less reliable)
async function getWunderground() {
  const $ = await fetchPage(
    "https://www.wunderground.com/forecast/gb/london"
  );

  const temps = [];
  $("span").each((i, el) => {
    const text = $(el).text();
    if (text.includes("°")) temps.push(text);
  });

  return extractTemps(temps);
}

function getHighestPerDay(sources) {
  const result = [];

  for (let i = 0; i < 3; i++) {
    const temps = {
      wunderground: sources.wunderground[i],
      meteoblue: sources.meteoblue[i],
      accuweather: sources.accuweather[i]
    };

    const valid = Object.entries(temps).filter(([_, v]) => v != null);

    if (valid.length === 0) {
      result.push({ day: i + 1, provider: null, value: null });
      continue;
    }

    const highest = valid.reduce((max, curr) =>
      curr[1] > max[1] ? curr : max
    );

    result.push({
      day: i + 1,
      provider: highest[0],
      value: highest[1]
    });
  }

  return result;
}

async function main() {
  const [wu, mb, aw] = await Promise.allSettled([
    getWunderground(),
    getMeteoblue(),
    getAccuWeather()
  ]);

  const sources = {
    wunderground: wu.value || [],
    meteoblue: mb.value || [],
    accuweather: aw.value || []
  };

  const highest = getHighestPerDay(sources);

  const output = {
    timestamp: new Date().toISOString(),
    sources,
    highest
  };

  fs.writeFileSync("result.json", JSON.stringify(output, null, 2));
}

main();
