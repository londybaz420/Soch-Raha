const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const { Octokit } = require('@octokit/rest');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require("yt-search");
const fetch = require("node-fetch"); 
const api = `https://api-dark-shan-yt.koyeb.app`;
const apikey = `edbcfabbca5a9750`;
const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting } = require('./settings');
//=======================================
const autoReact = getSetting('AUTO_REACT')|| 'off';

//=======================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    getContentType,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
//=======================================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '💚'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: '',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
    NEWSLETTER_JID: '120363315182578784@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: '',
    BOT_NAME: 'BANDAHEALI-MINI',
    OWNER_NAME: 'BANDAHEALI',
    OWNER_NUMBER: '923253617422',
    BOT_VERSION: '1.0.0',
    BOT_FOOTER: '> © 𝗣𝗢𝗪𝗘𝗥𝗘𝗗 𝗕𝗬 𝗕𝗔𝗡𝗗𝗛𝗘𝗔𝗟𝗜',
    CHANNEL_LINK: '',
    BUTTON_IMAGES: {
        ALIVE: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        MENU: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        OWNER: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        SONG: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        VIDEO: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg'
    }
};

// List Message Generator
function generateListMessage(text, buttonTitle, sections) {
    return {
        text: text,
        footer: config.BOT_FOOTER,
        title: buttonTitle,
        buttonText: "Select",
        sections: sections
    };
}
//=======================================
// Button Message Generator with Image Support
function generateButtonMessage(content, buttons, image = null) {
    const message = {
        text: content,
        footer: config.BOT_FOOTER,
        buttons: buttons,
        headerType: 1 // Default to text header
    };
//=======================================
    // Add image if provided
    if (image) {
        message.headerType = 4; // Image header
        message.image = typeof image === 'string' ? { url: image } : image;
    }

    return message;
}
//=======================================
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';
const otpStore = new Map();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}
//=======================================
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}
function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function getPakistanTimestamp() {
    return moment().tz('Asia/Karachi').format('YYYY-MM-DD HH:mm:ss');
}
async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith(`empire_${sanitizedNumber}_`) && file.name.endsWith('.json')
        ).sort((a, b) => {
            const timeA = parseInt(a.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            const timeB = parseInt(b.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            return timeB - timeA;
        });

        const configFiles = data.filter(file => 
            file.name === `config_${sanitizedNumber}.json`
        );

        if (sessionFiles.length > 1) {
            for (let i = 1; i < sessionFiles.length; i++) {
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: `session/${sessionFiles[i].name}`,
                    message: `Delete duplicate session file for ${sanitizedNumber}`,
                    sha: sessionFiles[i].sha
                });
                console.log(`Deleted duplicate session file: ${sessionFiles[i].name}`);
            }
        }

        if (configFiles.length > 1) {
            console.log(`Config file for ${sanitizedNumber} already exists`);
        }
    } catch (error) {
        console.error(`Failed to clean duplicate files for ${number}:`, error);
    }
}
//=======================================
async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        console.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
                console.log(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}
//=======================================
async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
        ? `Joined (ID: ${groupResult.gid})`
        : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(
        '*Connected Successful ✅*',
        `📞 Number: ${number}\n🩵 Status: Online`,
        `${config.BOT_FOOTER}`
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: config.IMAGE_PATH },
                    caption
                }
            );
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}
//=======================================
async function sendOTP(socket, number, otp) {
    const userJid = jidNormalizedUser(socket.user.id);
    const message = formatMessage(
        '"🔐 OTP VERIFICATION*',
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes.`,
        `${config.BOT_FOOTER}`
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        console.log(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${number}:`, error);
        throw error;
    }
}
//=======================================
function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['❤️'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId.toString(),
                        randomEmoji
                    );
                    console.log(`Reacted to newsletter message ${messageId} with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react to newsletter message ${messageId}, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter reaction error:', error);
        }
    });
}
//=======================================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (autoReact === 'on' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [message.key.participant] }
                        );
                        console.log(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}
//=======================================
async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getPakistanTimestamp();
        
        const message = formatMessage(
            '╭──◯',
            `│ \`D E L E T E\`\n│ *⦁ From :* ${messageKey.remoteJid}\n│ *⦁ Time:* ${deletionTime}\n│ *⦁ Type: Normal*\n╰──◯`,
            `${config.BOT_FOOTER}`
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

// Image resizing function
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

// Capitalize first letter
function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Generate serial
const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

// Send slide with news items
async function SendSlide(socket, jid, newsItems) {
    let anu = [];
    for (let item of newsItems) {
        let imgBuffer;
        try {
            imgBuffer = await resize(item.thumbnail, 300, 200);
        } catch (error) {
            console.error(`Failed to resize image for ${item.title}:`, error);
            imgBuffer = await Jimp.read('https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg');
            imgBuffer = await imgBuffer.resize(300, 200).getBufferAsync(Jimp.MIME_JPEG);
        }
        let imgsc = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        anu.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `*${capital(item.title)}*\n\n${item.body}`
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                hasMediaAttachment: true,
                ...imgsc
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐃𝙴𝙿𝙻𝙾𝚈","url":"https:/","merchant_url":"https://www.google.com"}`
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐂𝙾𝙽𝚃𝙰𝙲𝚃","url":"https","merchant_url":"https://www.google.com"}`
                    }
                ]
            })
        });
    }
    const msgii = await generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: "*Latest News Updates*"
                    }),
                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                        cards: anu
                    })
                })
            }
        }
    }, { userJid: jid });
    return socket.relayMessage(jid, msgii.message, {
        messageId: msgii.key.id
    });
}

// Fetch news from API
async function fetchNews() {
    try {
        const response = await axios.get(config.NEWS_JSON_URL);
        return response.data || [];
    } catch (error) {
        console.error('Failed to fetch news from raw JSON URL:', error.message);
        return [];
    }
}

// Setup command handlers with buttons and images
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
      //  let args = [];
        //let sender = msg.key.remoteJid;
       const ownerNumber = "923253617422"; 
         const type = getContentType(msg.message)
  const content = JSON.stringify(msg.message)
  const from = msg.key.remoteJid
  const quoted = type == 'extendedTextMessage' && msg.message.extendedTextMessage.contextInfo != null ? msg.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
        const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : (type == 'imageMessage') && msg.message.imageMessage.caption ? msg.message.imageMessage.caption : (type == 'videoMessage') && msg.message.videoMessage.caption ? msg.message.videoMessage.caption : ''
 const args = body.trim().split(/ +/).slice(1)
  const text = args.join(' ')
  const isGroup = from.endsWith('@g.us')
  const sender = msg.key.fromMe ? (socket.user.id.split(':')[0]+'@s.whatsapp.net' || socket.user.id) : (msg.key.participant || msg.key.remoteJid)
  const senderNumber = sender.split('@')[0]
  const botNumber = socket.user.id.split(':')[0]
  const pushname = msg.pushName || 'User'
  const isMe = botNumber.includes(senderNumber)
  
  const isOwner = [botNumber, '923253617422'].includes(senderNumber);
  
  const Owner = ownerNumber.includes(senderNumber) || isMe
  const botNumber2 = await jidNormalizedUser(socket.user.id);
  const groupMetadata = isGroup ? await socket.groupMetadata(from).catch(e => {}) : ''
  const groupName = isGroup ? groupMetadata.subject : ''
  const participants = isGroup ? await groupMetadata.participants : ''
  const groupAdmins = isGroup ? await getGroupAdmins(participants) : ''
  const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
  const isAdmins = isGroup ? groupAdmins.includes(sender) : false
  const isReact = msg.message.reactionMessage ? true : false
        
  const reply = async (teks) => {
  await socket.sendMessage(from, {
    text: teks,
    contextInfo: {
      mentionedJid: [sender],
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363315182578784@newsletter', // Newsletter JID
        newsletterName: "Bandaheali-Mini", // Newsletter name
        serverMessageId: 143 // Static ya dynamic ID
      }
    }
  }, { quoted: msg });
};

        // ======================
        // NORMAL TEXT COMMAND
        // ======================
        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                //args = parts.slice(1);
            }
        }

        // ======================
        // BUTTON COMMAND (PREFIX)
        // ======================
        else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;

            // if buttonId is like `.alive` etc.
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
             //   args = parts.slice(1);
            }

            // =====================
            // SONG BUTTON HANDLER
            // =====================
            if (buttonId?.startsWith("song-audio_")) {
                const [, url, title] = buttonId.split("_");
                await socket.sendMessage(from, {
                    audio: { url: decodeURIComponent(url) },
                    mimetype: 'audio/mpeg',
                    fileName: `${decodeURIComponent(title)}.mp3`
                }, { quoted: msg });
                return;
            }

            if (buttonId?.startsWith("song-doc_")) {
                const [, url, title] = buttonId.split("_");
                await socket.sendMessage(from, {
                    document: { url: decodeURIComponent(url) },
                    mimetype: "audio/mpeg",
                    fileName: `${decodeURIComponent(title)}.mp3`
                }, { quoted: msg });
                return;
            }
        }

    


        if (!command) return;

        try {
            switch (command) {   
            
            // ======================
// MENU COMMAND
// ======================
case 'menu':
case 'help':
case 'commands': {
    try {
        const menuText = `
✨ *EDITH-MD BOT MENU* ✨

📂 *MAIN COMMANDS*
• ${config.PREFIX}alive
• ${config.PREFIX}ping
• ${config.PREFIX}menu
• ${config.PREFIX}uptime

📂 *DOWNLOAD COMMANDS*
• ${config.PREFIX}getvideo
• ${config.PREFIX}getaudio
• ${config.PREFIX}getimage
• ${config.PREFIX}play
• ${config.PREFIX}fetch
• ${config.PREFIX}spotify

📂 *GROUP COMMANDS*
• ${config.PREFIX}join
• ${config.PREFIX}glink
• ${config.PREFIX}resetlink
• ${config.PREFIX}promote
• ${config.PREFIX}demote
• ${config.PREFIX}hidetag
• ${config.PREFIX}taggp
• ${config.PREFIX}ginfo
• ${config.PREFIX}kick
• ${config.PREFIX}lock
• ${config.PREFIX}unlock
• ${config.PREFIX}out

📂 *ISLAMIC COMMANDS*
• ${config.PREFIX}asmaulhusna
• ${config.PREFIX}ptime
• ${config.PREFIX}praytime

🤖 *Powered by EDITH-MD*
`;

        await reply(menuText);
    } catch (e) {
        console.error("Menu Error:", e);
        await reply("❌ Failed to fetch the menu.");
    }
    break;
}
                // ALIVE COMMAND WITH BUTTON
             case 'alive': {
    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = String(Math.floor(uptime / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((uptime % 3600) / 60)).padStart(2, '0');
    const seconds = String(Math.floor(uptime % 60)).padStart(2, '0');
    const formattedUptime = `${hours}:${minutes}:${seconds}`;

    const title = `✨ ʜᴇʟʟᴏ, *${pushname}* ✨\n\n🤖 ɪᴛ'ᴢ: *BANDAHEALI-MINI*`;
    
    const content = 
`╭───〔 *BOT STATUS* 〕───✦
│ 👑 *Owner:* BANDAHEALI
│ 🕒 *Uptime:* ${formattedUptime}
│ 👤 *User:* ${pushname}
│ 📡 *Prefix:* ${config.PREFIX}
╰─────────────────────✦

*◯ A B O U T*
> This is a lightweight, stable WhatsApp bot designed to run 24/7.  
> It allows easy configuration and group control.

*◯ D E P L O Y*
> 🌐 *Website:* https://bandaheali-mini.vercel.app`;

    const footer = config.BOT_FOOTER;

    await socket.sendMessage(from, {
        image: { url: config.BUTTON_IMAGES.ALIVE },
        caption: formatMessage(title, content, footer),
        buttons: [
            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 MENU' }, type: 1 },
            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: '⚡ PING' }, type: 1 }
        ],
        quoted: msg
    });
    break;
}
// ======================
// VV COMMAND
// ======================
case 'vv': {
    if (!isOwner) return;

    if (!quoted) {
        await reply("*🍁 Please reply to an image, video, or audio message!*");
        return;
    }

    try {
        const buffer = await quoted.download();
        const mtype = quoted.mtype;
        let messageContent = {};

        if (mtype === "imageMessage") {
            messageContent = {
                image: buffer,
                caption: quoted.text || '',
                mimetype: quoted.mimetype || "image/jpeg"
            };

        } else if (mtype === "videoMessage") {
            messageContent = {
                video: buffer,
                caption: quoted.text || '',
                mimetype: quoted.mimetype || "video/mp4"
            };

        } else if (mtype === "audioMessage") {
            messageContent = {
                audio: buffer,
                mimetype: "audio/mp4",
                ptt: quoted.ptt || false
            };

        } else {
            await reply("❌ Only image, video, and audio messages are supported");
            return;
        }

        // 🟢 Forward to bot’s own DM (owner JID)
        const ownerJid = socket.user.id;
        await socket.sendMessage(ownerJid, messageContent, { quoted: msg });

        await reply("✅ Message forwarded to Owner DM!");

    } catch (error) {
        console.error("vv Error:", error);
        await reply("❌ Error fetching vv message:\n" + error.message);
    }
    break;
}

//=======================================
case 'ping': {
    try {
        // Ping Speed Calculation
        const start = performance.now();
        await delay(100); // Small delay to measure latency
        const end = performance.now();
        const ping = Math.floor(end - start);

        // Uptime Calculation
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const title = '📡 System Status: *PING RESULT*';
        const content = `*© bY|* BANDAHEALI\n` +
                        `*◯ P I N G*\n` +
                        `> Response Speed: *${ping} ms*\n\n` +
                        `*◯ U P T I M E*\n` +
                        `> ${hours}h ${minutes}m ${seconds}s\n` +
                        `\n*Everything running smoothly ✅*`;

        const footer = config.BOT_FOOTER;

        await socket.sendMessage(from, {
            text: formatMessage(title, content, footer),
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
                { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: 'ALIVE' }, type: 1 }
            ],
            quoted: msg
        });
    } catch (e) {
        await socket.sendMessage(from, { text: "❌ Error while checking ping." }, { quoted: msg });
        console.error(e);
    }
    break;
								 }
								 
								 // ======================
// GITCLONE COMMAND
// ======================
case 'gitclone': {
    if (!q) {
        await reply(`❌ Please provide a GitHub repository link!\n\nExample:\n*${config.PREFIX}gitclone https://github.com/username/reponame*`);
        return;
    }

    try {
        // Validate GitHub repo link
        if (!q.includes("github.com")) {
            await reply("❌ Invalid GitHub link. Please provide a valid repo URL!");
            return;
        }

        // Extract username and repo name
        let url = q.split("github.com/")[1];
        let repo = url.split("/")[1]?.replace(/.git$/, "");
        let username = url.split("/")[0];

        if (!username || !repo) {
            await reply("❌ Could not extract repo details. Make sure link is in format:\nhttps://github.com/username/reponame");
            return;
        }

        // Direct ZIP download link
        let zipUrl = `https://github.com/${username}/${repo}/archive/refs/heads/main.zip`;

        await socket.sendMessage(from, {
            document: { url: zipUrl },
            mimetype: "application/zip",
            fileName: `${repo}-main.zip`
        }, { quoted: msg });

        await reply(`✅ Successfully fetched repository:\n📦 *${repo}*\n👤 Owner: *${username}*\n\n🔗 ${zipUrl}`);

    } catch (error) {
        console.error("GitClone Error:", error);
        await reply("❌ Error while cloning repo:\n" + error.message);
    }

    break;
}

// ======================
// GETVIDEO COMMAND
// ======================
case 'getvideo':
case 'tovideo':
case 'url2video':
case 'urltovideo':
case 'videofromurl':
case 'fetchvideo': {
    if (!q) {
        await reply(`❌ Please provide a video URL!\n\nExample:\n*${config.PREFIX}getvideo https://example.com/video.mp4*`);
        return;
    }

    const videoUrl = q.trim();

    // Validate URL
    if (!videoUrl.match(/^https?:\/\/.+\.(mp4|mov|webm|mkv)(\?.*)?$/i)) {
        await reply('❌ Invalid video URL! Must be a direct link to video (mp4/mov/webm/mkv)');
        return;
    }

    try {
        const axios = require("axios");
        // Verify the video exists
        const response = await axios.head(videoUrl).catch(() => null);
        if (!response || !response.headers['content-type']?.startsWith('video/')) {
            await reply('❌ URL does not point to a valid video');
            return;
        }

        // Send the video
        await socket.sendMessage(from, {
            video: { url: videoUrl },
            caption: '🎥 Here is your video from the URL'
        }, { quoted: msg });

    } catch (error) {
        console.error('GetVideo Error:', error);
        await reply('❌ Failed to process video. Error: ' + error.message);
    }

    break;
}
// ======================
// GETAUDIO COMMAND
// ======================
case 'getaudio':
case 'toaudio':
case 'url2audio':
case 'urltoaudio':
case 'audiofromurl':
case 'fetchaudio': {
    if (!q) {
        await reply(`❌ Please provide an audio URL!\n\nExample:\n*${config.PREFIX}getaudio https://example.com/song.mp3*`);
        return;
    }

    const audioUrl = q.trim();

    // Validate URL
    if (!audioUrl.match(/^https?:\/\/.+\.(mp3|wav|m4a|ogg|flac)(\?.*)?$/i)) {
        await reply('❌ Invalid audio URL! Must be a direct link to audio (mp3/wav/m4a/ogg/flac)');
        return;
    }

    try {
        const axios = require("axios");
        // Verify the audio exists
        const response = await axios.head(audioUrl).catch(() => null);
        if (!response || !response.headers['content-type']?.startsWith('audio/')) {
            await reply('❌ URL does not point to a valid audio file');
            return;
        }

        // Send the audio
        await socket.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: 'downloaded_audio.mp3'
        }, { quoted: msg });

    } catch (error) {
        console.error('GetAudio Error:', error);
        await reply('❌ Failed to process audio. Error: ' + error.message);
    }

    break;
}

// ======================
// GETIMAGE COMMAND
// ======================
case 'getimage':
case 'toimage':
case 'url2image':
case 'urltoimage':
case 'imagefromurl':
case 'fetchimage': {
    if (!q) {
        await reply(`❌ Please provide an image URL!\n\nExample:\n*${config.PREFIX}getimage https://example.com/photo.jpg*`);
        return;
    }

    const imageUrl = q.trim();

    // Validate URL
    if (!imageUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp|heic|svg)(\?.*)?$/i)) {
        await reply('❌ Invalid image URL! Must be a direct link to image (jpg/jpeg/png/gif/webp/bmp/heic/svg)');
        return;
    }

    try {
        const axios = require("axios");
        // Verify the image exists
        const response = await axios.head(imageUrl).catch(() => null);
        if (!response || !response.headers['content-type']?.startsWith('image/')) {
            await reply('❌ URL does not point to a valid image');
            return;
        }

        // Send the image
        await socket.sendMessage(from, {
            image: { url: imageUrl },
            caption: '🖼️ Here is your image from the URL'
        }, { quoted: msg });

    } catch (error) {
        console.error('GetImage Error:', error);
        await reply('❌ Failed to process image. Error: ' + error.message);
    }

    break;
}

// ======================
// FETCH COMMAND
// ======================
case 'fetch':
case 'getjson':
case 'api':
case 'apifetch': {
    if (!q) {
        await reply(`❌ Please provide an API URL!\n\nExample:\n*${config.PREFIX}fetch https://api.example.com/data*`);
        return;
    }

    const apiUrl = q.trim();

    // Validate URL
    if (!apiUrl.match(/^https?:\/\/.+/i)) {
        await reply('❌ Invalid URL! Please provide a valid API endpoint (http/https)');
        return;
    }

    try {
        const axios = require("axios");
        const response = await axios.get(apiUrl, { timeout: 15000 });

        if (!response.data) {
            await reply("❌ API did not return any data.");
            return;
        }

        // Pretty print JSON (max 4k chars for WhatsApp safety)
        let jsonText = JSON.stringify(response.data, null, 2);
        if (jsonText.length > 4000) {
            jsonText = jsonText.substring(0, 4000) + "\n... (truncated)";
        }

        await socket.sendMessage(from, {
            text: `📡 *API Response:*\n\n\`\`\`${jsonText}\`\`\``
        }, { quoted: msg });

    } catch (error) {
        console.error('Fetch Error:', error);
        await reply('❌ Failed to fetch API.\nError: ' + error.message);
    }

    break;
}
// ======================
// GROUP ADD COMMAND
// ======================
case 'add':
case 'groupadd':
case 'invite': {
    if (!isGroup) {
        await reply("❌ This command only works in groups.");
        return;
    }

    if (!isBotAdmins) {
        await reply("❌ I need to be *Admin* to add members.");
        return;
    }

    if (!isAdmins && !isOwner) {
        await reply("❌ Only group admins can use this command.");
        return;
    }

    if (!q) {
        await reply(`❌ Please provide a number to add.\n\nExample:\n*${config.PREFIX}add 923001234567*`);
        return;
    }

    try {
        let number = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

        // Add user
        await socket.groupParticipantsUpdate(from, [number], "add");

        await reply(`✅ Added @${q.replace(/[^0-9]/g, '')} to the group.`, { mentions: [number] });

    } catch (error) {
        console.error("Add Error:", error);
        await reply("❌ Failed to add member.\nError: " + error.message);
    }

    break;
}
// ======================
// TAGALL COMMAND
// ======================
case 'tagall':
case 'all':
case 'mentionall': {
    if (!isGroup) {
        await reply("❌ This command only works in groups.");
        return;
    }

    if (!isAdmins && !isOwner) {
        await reply("❌ Only *Group Admins* can use this command.");
        return;
    }

    try {
        let tagMessage = q ? q : `📢 *Attention Everyone!*`;

        let mentions = participants.map(u => u.id);
        let tagText = `*👥 Group:* ${groupName}\n*📌 Message:* ${tagMessage}\n\n`;

        participants.forEach((u, i) => {
            tagText += `${i + 1}. @${u.id.split('@')[0]}\n`;
        });

        await socket.sendMessage(from, {
            text: tagText,
            mentions
        }, { quoted: msg });

    } catch (error) {
        console.error("TagAll Error:", error);
        await reply("❌ Failed to tag all.\nError: " + error.message);
    }

    break;
}
// ======================
// KICK COMMAND
// ======================
case 'kick':
case 'remove':
case 'ban': {
    if (!isGroup) {
        await reply("❌ This command only works in groups.");
        return;
    }

    if (!isBotAdmins) {
        await reply("❌ I need to be *Admin* to kick members.");
        return;
    }

    if (!isAdmins && !isOwner) {
        await reply("❌ Only *Group Admins* can use this command.");
        return;
    }

    try {
        let users = [];

        // Agar tag mention hua ho
        if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
            users = msg.message.extendedTextMessage.contextInfo.mentionedJid;
        } 
        // Agar kisi ka message reply hua ho
        else if (quoted && quoted.sender) {
            users = [quoted.sender];
        } 
        // Agar number diya ho
        else if (q) {
            let number = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
            users = [number];
        } 
        else {
            await reply(`❌ Please tag/reply to a user or provide a number.\n\nExample:\n*${config.PREFIX}kick @user*\n*${config.PREFIX}kick 923001234567*`);
            return;
        }

        for (let user of users) {
            // ✅ Owner protection check
            if (isOwner && user.split("@")[0] === senderNumber) {
                await reply("❌ I can't remove my Owner!");
                continue;
            }

            await socket.groupParticipantsUpdate(from, [user], "remove");
        }

        await reply(`✅ Removed: ${users.map(u => `@${u.split('@')[0]}`).join(", ")}`, { mentions: users });

    } catch (error) {
        console.error("Kick Error:", error);
        await reply("❌ Failed to kick member(s).\nError: " + error.message);
    }

    break;
}
// ======================
// SET PROFILE PICTURE (OWNER ONLY)
// ======================
case 'setpp':
case 'setprofile':
case 'profilepic':
case 'changepic': {
    if (!isOwner) {
        await reply("❌ Only my *Owner* can change my profile picture.");
        break;
    }

    try {
        let media;

        if (quoted && quoted.mtype === "imageMessage") {
            // Agar reply kiya hai image par
            media = await quoted.download();

        } else if (msg.mtype === "imageMessage") {
            // Agar direct image bheji hai command ke sath
            media = await msg.download();

        } else {
            await reply("❌ Please send or reply to an *image* with this command.");
            break;
        }

        // 🟢 Profile Picture update
        await socket.updateProfilePicture(socket.user.id, media);
        await reply("✅ Profile picture updated successfully!");

    } catch (error) {
        console.error("SetPP Error:", error);
        await reply("❌ Failed to update profile picture.\nError: " + error.message);
    }
    break;
}
// ======================
// GET PROFILE PICTURE COMMAND
// ======================
case 'getpp':
case 'profile':
case 'getprofile': {
    if (!q) {
        await reply(`❌ Please provide a WhatsApp number!\n\nExample:\n*${config.PREFIX}getpp 923001234567*`);
        break;
    }

    try {
        // Normalize number to WhatsApp JID
        let number = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

        // Fetch profile picture URL
        let ppUrl = await socket.profilePictureUrl(number).catch(() => null);

        if (!ppUrl) {
            await reply("❌ Could not fetch profile picture. User may not have one or number is invalid.");
            break;
        }

        // Send profile picture
        await socket.sendMessage(from, {
            image: { url: ppUrl },
            caption: `🖼️ Profile picture of @${number.split("@")[0]}`
        }, { quoted: msg, mentions: [number] });

    } catch (error) {
        console.error("GetPP Error:", error);
        await reply("❌ Failed to fetch profile picture.\nError: " + error.message);
    }

    break;
}
// ======================
// YOUTUBE PLAY COMMAND
// ======================
case 'play':
case 'mix': {
    try {
    function replaceYouTubeID(url) {
    const regex = /(?:youtube\.com\/(?:.*v=|.*\/)|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
    }
    
    
    const audioAPIs = [
    {
        name: "Toxxic",
        url: (id) => `https://api-toxxic.zone.id/api/downloader/ytmp3?url=https://youtu.be/${id}`,
        parse: (res) => (res?.result && res?.data?.download) ? res.data.download : null
    },
    {
        name: "JerryCoder",
        url: (id) => `https://jerrycoder.oggyapi.workers.dev/ytmp3?url=https://youtu.be/${id}`,
        parse: (res) => (res?.status === "success" && res?.url) ? res.url : null
    },
    {
        name: "Codewave",
        url: (id) => `https://codewave-unit-dev-apis.zone.id/api/ytmp3?url=https://youtu.be/${id}`,
        parse: (res) => (res?.status && res?.result?.url) ? res.result.url : null
    }
];

// Video APIs (same as before ✅)
const videoAPIs = [
    { name: 'ytmp4', url: (id) => `https://api.giftedtech.co.ke/api/download/ytmp4?apikey=gifted&url=https://youtu.be/${id}` },
    { name: 'dlmp4', url: (id) => `https://api.giftedtech.co.ke/api/download/dlmp4?apikey=gifted&url=https://youtu.be/${id}` },
    { name: 'ytv', url: (id) => `https://api.giftedtech.co.ke/api/download/ytv?apikey=gifted&url=https://youtu.be/${id}` }
];

// 🔄 Try APIs sequentially with response parser
async function tryAPIs(apis, id, type = "audio") {
    for (let api of apis) {
        try {
            const response = await axios.get(api.url(id));
            if (type === "audio") {
                const url = api.parse(response.data);
                if (url) return url;
            } else {
                if (response.data.success && response.data.result.download_url) {
                    return response.data.result.download_url;
                }
            }
        } catch (e) {
            console.log(`❌ ${api.name} failed:`, e.message);
        }
    }
    throw new Error(`${type} APIs failed!`);
}

        if (!q) return reply("❌ Provide a YouTube link or search query.");

        let id = q.startsWith("https://") ? replaceYouTubeID(q) : null;

        if (!id) {
            const searchResults = await yts(q);
            if (!searchResults?.videos?.length) return reply("❌ No results found!");
            id = searchResults.videos[0].videoId;
        }

        const videoInfo = await yts({ videoId: id });
        if (!videoInfo) return reply("❌ Failed to fetch video!");

        const { url, title, image, timestamp, ago, views, author } = videoInfo;

        let caption = `🍄 *YT DOWNLOADER - Bandaheali-Mini* 🍄\n\n` +
                      `🎵 *Title:* ${title}\n` +
                      `⏳ *Duration:* ${timestamp}\n` +
                      `👀 *Views:* ${views}\n` +
                      `🌏 *Released:* ${ago}\n` +
                      `👤 *Channel:* ${author?.name}\n` +
                      `🖇 *Link:* ${url}\n\n` +
                      `👉 Reply:\n` +
                      `1 = Audio 🎶\n` +
                      `2 = Video 🎥\n` +
                      `3 = Audio Doc 📁\n` +
                      `4 = Video Doc 📂\n\n` +
                      `🤖 Powered by *Bandaheali-Mini*`;

        const sentMsg = await socket.sendMessage(from, { image: { url: image }, caption }, { quoted: msg });
        const messageID = sentMsg.key.id;

        const replyHandler = async (messageUpdate) => {
            const msgInfo = messageUpdate?.messages[0];
            if (!msgInfo?.message || msgInfo.key.remoteJid !== from) return;

            const messageText = msgInfo.message.conversation || msgInfo.message.extendedTextMessage?.text || '';
            const isReply = msgInfo.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;
            if (!isReply) return;

            socket.ev.off('messages.upsert', replyHandler);

            const choice = messageText.trim();
            if (!["1", "2", "3", "4"].includes(choice)) {
                return socket.sendMessage(from, { text: "❌ Invalid choice. Reply with 1, 2, 3, or 4." }, { quoted: msg });
            }

            let downloadUrl;
            if (["1", "3"].includes(choice)) {
                downloadUrl = await tryAPIs(audioAPIs, id, "audio");
                if (!downloadUrl) return reply("❌ Audio download failed!");

                if (choice === "1") {
                    await socket.sendMessage(from, { audio: { url: downloadUrl }, mimetype: "audio/mpeg", fileName: `${title}.mp3` }, { quoted: msg });
                } else {
                    await socket.sendMessage(from, { document: { url: downloadUrl }, fileName: `${title}.mp3`, mimetype: "audio/mpeg", caption: title }, { quoted: msg });
                }
            } else {
                downloadUrl = await tryAPIs(videoAPIs, id, "video");
                if (!downloadUrl) return reply("❌ Video download failed!");

                if (choice === "2") {
                    await socket.sendMessage(from, { video: { url: downloadUrl }, caption: title }, { quoted: msg });
                } else {
                    await socket.sendMessage(from, { document: { url: downloadUrl }, fileName: `${title}.mp4`, mimetype: "video/mp4", caption: title }, { quoted: msg });
                }
            }

            await socket.sendMessage(from, { text: "✅ Done!" }, { quoted: msg });
        };

        socket.ev.on('messages.upsert', replyHandler);
        setTimeout(() => socket.ev.off('messages.upsert', replyHandler), 60000);

    } catch (e) {
        reply(`❌ Error: ${e.message}`);
    }
    break;
}

// ======================
// OUT COMMAND - REMOVE USERS BY COUNTRY CODE
// ======================
case 'out': {
    if (!isGroup) {
        await reply("❌ This command only works in groups.");
        break;
    }

    if (!isBotAdmins) {
        await reply("❌ I need to be *Admin* to remove members.");
        break;
    }

    if (!isAdmins && !isOwner) {
        await reply("❌ Only *Group Admins* can use this command.");
        break;
    }

    if (!q) {
        await reply(`❌ Please provide a country code!\n\nExample:\n*${config.PREFIX}out 92*`);
        break;
    }

    const countryCode = q.replace(/\D/g, ""); // Only digits
    if (!countryCode) {
        await reply("❌ Invalid country code.");
        break;
    }

    try {
        let toRemove = [];

        // Loop through participants
        for (let p of participants) {
            const userNumber = p.id.split("@")[0];

            // Skip bot and owner
            if (userNumber === botNumber || isOwner) continue;

            if (userNumber.startsWith(countryCode)) {
                toRemove.push(p.id);
            }
        }

        if (!toRemove.length) {
            await reply(`⚠️ No users found with country code +${countryCode}`);
            break;
        }

        // Remove users
        await socket.groupParticipantsUpdate(from, toRemove, "remove");
        await reply(`✅ Removed ${toRemove.length} users with country code +${countryCode}`, { mentions: toRemove });

    } catch (error) {
        console.error("OUT Command Error:", error);
        await reply("❌ Failed to remove users.\nError: " + error.message);
    }

    break;
}
// ======================
// LOCK COMMAND
// ======================
case 'lock': {
    if (!isGroup) {
        await reply("❌ This command only works in groups.");
        break;
    }

    if (!isAdmins && !isOwner) {
        await reply("❌ Only *Group Admins* can lock the group.");
        break;
    }

    if (!isBotAdmins) {
        await reply("❌ I need to be *Admin* to change group settings.");
        break;
    }

    try {
        await socket.groupSettingUpdate(from, 'announcement'); // 'announcement' = only admins can send messages
        await reply("🔒 Group locked! Only admins can send messages now.");
    } catch (error) {
        console.error("Lock Error:", error);
        await reply("❌ Failed to lock the group.\nError: " + error.message);
    }

    break;
}

// ======================
// UNLOCK COMMAND
// ======================
case 'unlock': {
    if (!isGroup) {
        await reply("❌ This command only works in groups.");
        break;
    }

    if (!isAdmins && !isOwner) {
        await reply("❌ Only *Group Admins* can unlock the group.");
        break;
    }

    if (!isBotAdmins) {
        await reply("❌ I need to be *Admin* to change group settings.");
        break;
    }

    try {
        await socket.groupSettingUpdate(from, 'not_announcement'); // 'not_announcement' = all participants can send messages
        await reply("🔓 Group unlocked! All participants can send messages now.");
    } catch (error) {
        console.error("Unlock Error:", error);
        await reply("❌ Failed to unlock the group.\nError: " + error.message);
    }

    break;
}
    // ======================
    // JOIN GROUP
    // ======================
    case 'join':
    case 'joinme':
    case 'f_join': {
        if (!isOwner) return reply("❌ Only owner can use this command");
        if (!q) return reply("*Please write the Group Link* 🖇️");

        try {
            const code = args[0].split('https://chat.whatsapp.com/')[1];
            await socket.groupAcceptInvite(code);
            await reply("✔️ *Successfully Joined*");
        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }

    // ======================
    // GET GROUP LINK
    // ======================
    case 'glink':
    case 'grouplink':
    case 'invite': {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins && !isOwner) return reply("❌ You must be admin to use this command.");
        if (!isBotAdmins) return reply("❌ Give me admin rights");

        try {
            const code = await socket.groupInviteCode(from);
            await reply(`🖇️ *Group Link*\n\nhttps://chat.whatsapp.com/${code}`);
        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }

    // ======================
    // RESET GROUP LINK
    // ======================
    case 'resetlink':
    case 'revokegrouplink':
    case 'resetglink':
    case 'revokelink':
    case 'f_revoke': {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins && !isOwner) return reply("❌ You must be admin to use this command.");
        if (!isBotAdmins) return reply("❌ Give me admin rights");

        try {
            await socket.groupRevokeInvite(from);
            await reply("*Group link Reseted* ⛔");
        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }

    // ======================
    // PROMOTE TO ADMIN
    // ======================
    case 'promote':
    case 'addadmin': {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins && !isOwner) return reply("❌ You must be admin to use this command.");
        if (!isBotAdmins) return reply("❌ Give me admin rights");

        try {
            let user = msg.mentionedJid ? msg.mentionedJid[0] : quoted?.sender;
            if (!user) return reply("❌ Couldn't find any user in context");
            if (groupAdmins.includes(user)) return reply("❗ User Already an Admin ✔️");

            await socket.groupParticipantsUpdate(from, [user], "promote");
            await reply("*User promoted as an Admin* ✔️");
        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }

    // ======================
    // DEMOTE ADMIN
    // ======================
    case 'demote':
    case 'removeadmin': {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins && !isOwner) return reply("❌ You must be admin to use this command.");
        if (!isBotAdmins) return reply("❌ Give me admin rights");

        try {
            let user = msg.mentionedJid ? msg.mentionedJid[0] : quoted?.sender;
            if (!user) return reply("❌ Couldn't find any user in context");
            if (!groupAdmins.includes(user)) return reply("❗ User Already not an Admin");

            await socket.groupParticipantsUpdate(from, [user], "demote");
            await reply("*User no longer an Admin* ✔️");
        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }

    // ======================
    // HIDETAG / TAG ALL
    // ======================
    case 'hidetag': {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins && !isOwner) return reply("❌ You must be admin to use this command.");
        if (!isBotAdmins) return reply("❌ Give me admin rights");
        if (!q) return reply("❌ Please add a message");

        try {
            const teks = q;
            await socket.sendMessage(from, { text: teks, mentions: participants.map(a => a.id) });
        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }

    case 'taggp':
    case 'tggp':
    case 'djtaggp': {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!quoted) return reply("❌ Please reply to a message to tag it");
        if (!q) return reply("❌ Please provide a group JID");

        try {
            const teks = quoted?.msg || "";
            await socket.sendMessage(q, { text: teks, mentions: participants.map(a => a.id) });
        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }

    // ======================
    // GROUP INFO
    // ======================
    case 'ginfo':
    case 'groupinfo': {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins && !isOwner) return reply("❌ Only Group Admins or Bot Dev can use this.");
        if (!isBotAdmins) return reply("❌ I need admin rights to fetch group details");

        try {
            const metadata = await socket.groupMetadata(from);
            const listAdmins = participants.filter(p => p.admin).map((v, i) => `${i+1}. @${v.id.split('@')[0]}`).join("\n");
            const owner = metadata.owner || participants.find(p => p.admin)?.id || "unknown";

            const gdata = `*「 Group Information 」*\n\n` +
                          `*Group Name* : ${metadata.subject}\n` +
                          `*Group ID* : ${metadata.id}\n` +
                          `*Participants* : ${metadata.size}\n` +
                          `*Group Creator* : @${owner.split('@')[0]}\n` +
                          `*Description* : ${metadata.desc?.toString() || 'No description'}\n` +
                          `*Admins (${participants.filter(p => p.admin).length})*:\n${listAdmins}`;

            const fallbackPp = 'https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png';
            let ppUrl;
            try { ppUrl = await socket.profilePictureUrl(from, 'image'); } catch { ppUrl = fallbackPp; }

            await socket.sendMessage(from, {
                image: { url: ppUrl },
                caption: gdata,
                mentions: participants.filter(p => p.admin).map(p => p.id).concat([owner])
            });

        } catch (e) {
            console.error(e);
            await reply(`❌ Error: ${e.message}`);
        }
        break;
    }
//=======================================
               
                
                // OWNER COMMAND WITH VCARD
                case 'owner': {
    if (!isOwner) {
        await reply("❌ This command is only for the bot owner!");
        return;
    }

    const ownerNum = "923253617422"; // apna number daal lena
    const ownerName = "BANDAHEALI";     // apna naam daal lena

    const text = `👑 *BOT OWNER INFORMATION* 👑

🔹 *Name:* ${ownerName}
🔹 *Number:* wa.me/${ownerNum}
🔹 *Status:* Online ✅

⚡ Powered by ${ownerName}`;

    await socket.sendMessage(from, {
        text,
        contextInfo: {
            mentionedJid: [sender]
        }
    }, { quoted: msg });
    break;
}
case 'fancy': {
    const axios = require("axios");

    // Message text extract
    const q =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption || '';

    // Remove prefix (.fancy) from text
    const text = q.trim().split(/\s+/).slice(1).join(" ");

    if (!text) {
        return await socket.sendMessage(from, {
            text: "❎ *Please provide text to convert into fancy fonts.*\n\n📌 *Example:* `.fancy Bandaheali`"
        }, { quoted: msg });
    }

    try {
        const apiUrl = `https://www.dark-yasiya-api.site/other/font?text=${encodeURIComponent(text)}`;
        const { data } = await axios.get(apiUrl);

        if (!data || !data.status || !data.result) {
            return await socket.sendMessage(from, {
                text: "❌ *Error fetching fonts from API. Please try again later.*"
            }, { quoted: msg });
        }

        // Format fonts list
        const fontList = data.result
            .map((font, i) => `*${i + 1}. ${font.name}:*\n${font.result}`)
            .join("\n\n");

        const finalMessage = `🎨 *Fancy Fonts Converter*\n\n${fontList}\n\n✨ POWERED BY BANDAHEALI-MD ✨`;

        await socket.sendMessage(from, {
            text: finalMessage
        }, { quoted: msg });

    } catch (err) {
        console.error("Fancy Font Error:", err);
        await socket.sendMessage(from, {
            text: "⚠️ *An error occurred while converting to fancy fonts.*"
        }, { quoted: msg });
    }

    break;
}
    // ======================
    // ASMA-UL-HUSNA COMMAND
    // ======================
    case 'asmaulhusna':
    case 'allahnames':
    case 'asma': {
        try {
            const url = `https://api.nexoracle.com/islamic/asma-ul-husna`;

            // Optionally show fetching message
            // await reply("⏳ Fetching a beautiful name of Allah ...");

            const res = await axios.get(url);
            const data = res.data?.result;

            if (!data || !data.name) return reply("⚠️ No name found. Try again later.");

            const textMsg = `✨ *Asma-ul-Husna*\n\n~ The Beautiful Name of Allah ﷻ ~\n\n${data.name}`;
            await reply(textMsg);

        } catch (err) {
            console.error("asmaulhusna error:", err?.response?.status, err?.message);
            const status = err?.response?.status;
            if (status === 404) return reply("❌ Not found. Try again later.");
            if (status === 401 || status === 403) return reply("🔒 Unauthorized.");
            return reply(`❌ Failed to fetch Asma-ul-Husna.\n• Reason: ${err?.message || "Unknown"}`);
        }
        break;
    }

    // ======================
    // PRAYER TIMES COMMAND
    // ======================
    case 'praytime':
    case 'prayertimes':
    case 'prayertime':
    case 'ptime': {
        try {
            const city = args.length > 0 ? args.join(" ") : "NawabShah"; // Default city
            const apiUrl = `https://api.nexoracle.com/islamic/prayer-times?city=${city}`;

            const response = await fetch(apiUrl);

            if (!response.ok) return reply('❌ Error fetching prayer times!');

            const data = await response.json();

            if (data.status !== 200) return reply('❌ Failed to get prayer times. Try again later.');

            const prayerTimes = data.result.items[0];
            const weather = data.result.today_weather;
            const location = data.result.city;

            let dec = `*Prayer Times for ${location}, ${data.result.state}*\n\n`;
            dec += `📍 *Location*: ${location}, ${data.result.state}, ${data.result.country}\n`;
            dec += `🕌 *Method*: ${data.result.prayer_method_name}\n\n`;
            dec += `🌅 *Fajr*: ${prayerTimes.fajr}\n`;
            dec += `🌄 *Shurooq*: ${prayerTimes.shurooq}\n`;
            dec += `☀️ *Dhuhr*: ${prayerTimes.dhuhr}\n`;
            dec += `🌇 *Asr*: ${prayerTimes.asr}\n`;
            dec += `🌆 *Maghrib*: ${prayerTimes.maghrib}\n`;
            dec += `🌃 *Isha*: ${prayerTimes.isha}\n\n`;
            dec += `🧭 *Qibla Direction*: ${data.result.qibla_direction}°\n`;

            const temperature = weather.temperature !== null ? `${weather.temperature}°C` : 'Data not available';
            dec += `🌡️ *Temperature*: ${temperature}\n`;

            await socket.sendMessage(
                from,
                {
                    image: { url: config.MENU_IMAGE_URL },
                    caption: dec,
                    contextInfo: {
                        mentionedJid: [sender],
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363315182578784@newsletter',
                            newsletterName: 'Bandaheali-MiNi',
                            serverMessageId: 143
                        }
                    }
                },
                { quoted: msg }
            );

        } catch (e) {
            console.error("Praytime Error:", e);
            reply('❌ Error occurred while fetching prayer times and weather.');
        }
        break;
    }
    
	      case 'tiks': {
    const axios = require('axios');

    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              msg.message?.imageMessage?.caption ||
              msg.message?.videoMessage?.caption || '';

    const query = q.replace(/^[.\/!]ts\s*/i, '').trim();

    if (!query) {
        return await socket.sendMessage(from, {
            text: '[❗] TikTok. what you want to watch 🔍'
        }, { quoted: msg });
    }

    async function tiktokSearch(query) {
        try {
            const searchParams = new URLSearchParams({
                keywords: query,
                count: '10',
                cursor: '0',
                HD: '1'
            });

            const response = await axios.post("https://tikwm.com/api/feed/search", searchParams, {
                headers: {
                    'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8",
                    'Cookie': "current_language=en",
                    'User-Agent': "Mozilla/5.0"
                }
            });

            const videos = response.data?.data?.videos;
            if (!videos || videos.length === 0) {
                return { status: false, result: "No videos found." };
            }

            return {
                status: true,
                result: videos.map(video => ({
                    description: video.title || "No description",
                    videoUrl: video.play || ""
                }))
            };
        } catch (err) {
            return { status: false, result: err.message };
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    try {
        const searchResults = await tiktokSearch(query);
        if (!searchResults.status) throw new Error(searchResults.result);

        const results = searchResults.result;
        shuffleArray(results);

        const selected = results.slice(0, 6);

        const cards = await Promise.all(selected.map(async (vid) => {
            const videoBuffer = await axios.get(vid.videoUrl, { responseType: "arraybuffer" });

            const media = await prepareWAMessageMedia({ video: videoBuffer.data }, {
                upload: socket.waUploadToServer
            });

            return {
                body: proto.Message.InteractiveMessage.Body.fromObject({ text: '' }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "BANDAHEALI MINI" }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                    title: vid.description,
                    hasMediaAttachment: true,
                    videoMessage: media.videoMessage // 🎥 Real video preview
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                    buttons: [] // ❌ No buttons
                })
            };
        }));

        const msgContent = generateWAMessageFromContent(from, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: { text: `🔎 *TikTok Search:* ${query}` },
                        footer: { text: "> 𝐏𝙾𝚆𝙴𝚁𝙳 𝐁𝚈 BANDAHEALI-MINI" },
                        header: { hasMediaAttachment: false },
                        carouselMessage: { cards }
                    })
                }
            }
        }, { quoted: msg });

        await socket.relayMessage(from, msgContent.message, { messageId: msgContent.key.id });

    } catch (err) {
        await socket.sendMessage(from, {
            text: `❌ Error: ${err.message}`
        }, { quoted: msg });
    }

    break;
		  }
					
                // JID COMMAND
                case 'jid': {
                    await socket.sendMessage(from, {
                        text: `*🆔 Chat JID:* ${sender}`
                    });
                    break;
                }

                // BOOM COMMAND        
                case 'boom': {
                if (!isOwner) return reply('Only Owner Can use This Command');
                    if (args.length < 2) {
                        return await socket.sendMessage(from, { 
                            text: "📛 *Usage:* `.boom <count> <message>`\n📌 *Example:* `.boom 100 Hello*`" 
                        });
                    }

                    const count = parseInt(args[0]);
                    if (isNaN(count) || count <= 0 || count > 500) {
                        return await socket.sendMessage(from, { 
                            text: "❗ Please provide a valid count between 1 and 500." 
                        });
                    }

                    const message = args.slice(1).join(" ");
                    for (let i = 0; i < count; i++) {
                        await socket.sendMessage(from, { text: message });
                        await new Promise(resolve => setTimeout(resolve, 500)); // Optional delay
                    }

                    break;
                }

                // SONG DOWNLOAD COMMAND WITH BUTTON
                
   case 'song': {
    try {
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const q = text.split(" ").slice(1).join(" ").trim();

        if (!q) {
            await socket.sendMessage(from, { 
                text: '*🚫 Please enter a song name to search.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
                ]
            });
            return;
        }

        // API CALL - Nekolabs
        const apiUrl = `https://api.nekolabs.my.id/downloader/youtube/play/v1?q=${encodeURIComponent(q)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data.status || !data.result) {
            await socket.sendMessage(from, { 
                text: '*🚩 Result Not Found or API Error.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
                ]
            });
            return;
        }

        const { title, channel, duration, cover, url } = data.result.metadata;
        const downloadUrl = data.result.downloadUrl;

        const titleText = '*༊ BANDAHEALI-MINI SONG DOWNLOADER*';
        const content = `┏━━━━━━━━━━━━━━━━\n` +
            `┃📝 \`Title\` : ${title}\n` +
            `┃📺 \`Channel\` : ${channel}\n` +
            `┃🕛 \`Duration\` : ${duration}\n` +
            `┃🔗 \`URL\` : ${url}\n` +
            `┗━━━━━━━━━━━━━━━━`;

        const footer = config.BOT_FOOTER || '';
        const captionMessage = formatMessage(titleText, content, footer);

        // Show song info + choice buttons
        await socket.sendMessage(from, {
            image: { url: cover },
            caption: captionMessage,
            buttons: [
                { buttonId: `song-audio_${encodeURIComponent(downloadUrl)}_${encodeURIComponent(title)}`, buttonText: { displayText: '🎵 Get Audio' }, type: 1 },
                { buttonId: `song-doc_${encodeURIComponent(downloadUrl)}_${encodeURIComponent(title)}`, buttonText: { displayText: '📂 Get Document' }, type: 1 },
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
            ],
            footer: footer
        });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(from, { 
            text: '*❌ Internal Error. Please try again later.*',
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
            ]
        });
    }
    break;
}
                
                // NEWS COMMAND
                case 'news': {
                    await socket.sendMessage(from, {
                        text: '📰 Fetching latest news...'
                    });
                    const newsItems = await fetchNews();
                    if (newsItems.length === 0) {
                        await socket.sendMessage(from, {
                            image: { url: config.IMAGE_PATH },
                            caption: formatMessage(
                                '🗂️ NO NEWS AVAILABLE',
                                '❌ No news updates found at the moment. Please try again later.',
                                `${config.BOT_FOOTER}`
                            )
                        });
                    } else {
                        await SendSlide(socket, from, newsItems.slice(0, 5));
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(from, {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '❌ ERROR',
                    'An error occurred while processing your command. Please try again.',
                    `${config.BOT_FOOTER}`
                )
            });
        }
    });
}

// Setup message handlers
function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

// Delete session from GitHub
async function deleteSessionFromGitHub(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.includes(sanitizedNumber) && file.name.endsWith('.json')
        );

        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: `session/${file.name}`,
                message: `Delete session for ${sanitizedNumber}`,
                sha: file.sha
            });
        }
    } catch (error) {
        console.error('Failed to delete session from GitHub:', error);
    }
}

// Restore session from GitHub
async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name === `creds_${sanitizedNumber}.json`
        );

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `session/${latestSession.name}`
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

// Load user config
async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: configPath
        });

        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...config };
    }
}

// Update user config
async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        let sha;

        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path: configPath
            });
            sha = data.sha;
        } catch (error) {
        }

        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: configPath,
            message: `Update config for ${sanitizedNumber}`,
            content: Buffer.from(JSON.stringify(newConfig, null, 2)).toString('base64'),
            sha
        });
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
}

// Setup auto restart
function setupAutoRestart(socket, number) {
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(`Connection lost for ${number}, attempting to reconnect...`);
            await delay(10000);
            activeSockets.delete(number.replace(/[^0-9]/g, ''));
            socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
        }
    });
}

// Main pairing function
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await initUserEnvIfMissing(sanitizedNumber);
  await initEnvsettings(sanitizedNumber);
  
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    await cleanDuplicateFiles(sanitizedNumber);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code: ${retries}, error.message`, retries);
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            let sha;
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: `session/creds_${sanitizedNumber}.json`
                });
                sha = data.sha;
            } catch (error) {
            }

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `session/creds_${sanitizedNumber}.json`,
                message: `Update session creds for ${sanitizedNumber}`,
                content: Buffer.from(fileContent).toString('base64'),
                sha
            });
            console.log(`Updated creds for ${sanitizedNumber} in GitHub`);
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                        console.log('✅ Auto-followed newsletter & reacted ❤️');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                    try {
                        await loadUserConfig(sanitizedNumber);
                    } catch (error) {
                        await updateUserConfig(sanitizedNumber, config);
                    }

                    activeSockets.set(sanitizedNumber, socket);

                    const groupStatus = groupResult.status === 'success'
                        ? 'Joined successfully'
                        : `Failed to join group: ${groupResult.error}`;
                    await socket.sendMessage(userJid, {
                        image: { url: config.IMAGE_PATH },
                        caption: formatMessage(
`🌐━━━━━━━━━━━━━━━🌐
   ✅ *CONNECTION SUCCESSFUL*
🌐━━━━━━━━━━━━━━━🌐

🔢 *Number:* ${sanitizedNumber}
⚡ *Status:* Connected & Ready

━━━━━━━━━━━━━━━━━━━
✨ POWERED BY BANDAHEALI ✨`
                        )
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env.PM2_NAME || 'BANDAHEALI-Md-Free-Bot-Session'}`);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// Routes
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: 'BOT is running',
        activesession: activeSockets.size
    });
});

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith('creds_') && file.name.endsWith('.json')
        );

        if (sessionFiles.length === 0) {
            return res.status(404).send({ error: 'No session files found in GitHub repository' });
        }

        const results = [];
        for (const file of sessionFiles) {
            const match = file.name.match(/creds_(\d+)\.json/);
            if (!match) {
                console.warn(`Skipping invalid session file: ${file.name}`);
                results.push({ file: file.name, status: 'skipped', reason: 'invalid_file_name' });
                continue;
            }

            const number = match[1];
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes);
                results.push({ number, status: 'connection_initiated' });
            } catch (error) {
                console.error(`Failed to reconnect bot for ${number}:`, error);
                results.push({ number, status: 'failed', error: error.message });
            }
            await delay(1000);
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const otp = generateOTP();
    otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date.now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).send({ error: 'Invalid OTP' });
    }

    try {
        await updateUserConfig(sanitizedNumber, storedData.newConfig);
        otpStore.delete(sanitizedNumber);
        const socket = activeSockets.get(sanitizedNumber);
        if (socket) {
            await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '*📌 CONFIG UPDATED*',
                    'Your configuration has been successfully updated!',
                    `${config.BOT_FOOTER}`
                )
            });
        }
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
    } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) {
        return res.status(400).send({ error: 'Number and target number are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        const statusData = await socket.fetchStatus(targetJid);
        const aboutStatus = statusData.status || 'No status available';
        const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
        res.status(200).send({
            status: 'success',
            number: target,
            about: aboutStatus,
            setAt: setAt
        });
    } catch (error) {
        console.error(`Failed to fetch status for ${target}:`, error);
        res.status(500).send({
            status: 'error',
            message: `Failed to fetch About status for ${target}. The number may not exist or the status is not accessible.`
        });
    }
});

// Cleanup
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'BOT-session'}`);
});

module.exports = router;
