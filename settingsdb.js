// settingsdb.js
const axios = require('axios');

const BASE_URL = 'https://toge-md-v5-default-rtdb.firebaseio.com/';

async function updateUserEnv(key, value, userId) {
  if (!userId) throw new Error("User ID missing");
  
  const res = await axios.put(`${BASE_URL}/${userId}/${key}.json`, JSON.stringify(value));
  return res.data;
}

async function getUserEnv(key, userId) {
  if (!userId) throw new Error("User ID missing");
  
  const res = await axios.get(`${BASE_URL}/${userId}/${key}.json`);
  return res.data;
}

async function getAllUserEnv(userId) {
  if (!userId) throw new Error("User ID missing");
  
  const res = await axios.get(`${BASE_URL}/${userId}.json`);
  return res.data || {};
}

async function initUserEnvIfMissing(userId) {
  if (!userId) {
    console.error("❌ User ID is missing");
    return;
  }

  const defaults = {
    AUTO_REACT: "off",
    PRESENCE_TYPE: "on", 
    PRESENCE_FAKE: "both",
    ANTI_CALL: "on",
    ANTI_DELETE: "on",
    CREATE_NB: userId
  };

  for (const key in defaults) {
    const current = await getUserEnv(key, userId);
    if (current === null || current === undefined) {
      await updateUserEnv(key, defaults[key], userId);
      console.log(`✅ Initialized [${userId}] ${key} = ${defaults[key]}`);
    }
  }
}

module.exports = {
  updateUserEnv,
  getUserEnv,
  getAllUserEnv,
  initUserEnvIfMissing
};
