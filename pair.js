// ASTRIX-MD-MINI POWERED BY ROMEK-XD
// Multi-device WhatsApp bot with enhanced features and robust error handling

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
const yts = require('yt-search');
const fetch = require('node-fetch');
const api = `https://api-dark-shan-yt.koyeb.app`;
const apikey = process.env.YT_API_KEY || 'edbcfabbca5a9750'; // Use environment variable for API key
const { initUserEnvIfMissing, initEnvsettings, getSetting } = require('./settings');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');

// Logger configuration
const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    timestamp: pino.stdTimeFunctions.isoTime
});

// Configuration
const config = {
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS || 'true',
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || 'true',
    AUTO_RECORDING: process.env.AUTO_RECORDING || 'true',
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '💚'],
    PREFIX: process.env.PREFIX || '.',
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
    GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || 'https://chat.whatsapp.com/FZCfxAjwGDp2klCqLz3Lci',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
    NEWSLETTER_JID: process.env.NEWSLETTER_JID || '120363315182578784',
    NEWSLETTER_MESSAGE_ID: process.env.NEWSLETTER_MESSAGE_ID || '428',
    OTP_EXPIRY: parseInt(process.env.OTP_EXPIRY) || 300000,
    NEWS_JSON_URL: process.env.NEWS_JSON_URL || '',
    BOT_NAME: 'Bandaheali-Mini',
    OWNER_NAME: 'Bandaheali',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '923143200187',
    BOT_VERSION: '2.0.0', // Updated version
    BOT_FOOTER: '> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴏᴍᴇᴋ-xᴅ',
    CHANNEL_LINK: process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029VbB0E2MBvvsiMnWBM72n',
    BUTTON_IMAGES: {
        ALIVE: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        MENU: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        OWNER: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        SONG: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        VIDEO: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg',
        STICKER: 'https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg'
    },
    COOLDOWN_SECONDS: parseInt(process.env.COOLDOWN_SECONDS) || 5, // Command cooldown
    RATE_LIMIT: parseInt(process.env.RATE_LIMIT) || 100 // Max commands per minute
};

// Command cooldown and rate limiting
const commandCooldowns = new Map();
const commandCounts = new Map();

// Auto react setting
const autoReact = getSetting('AUTO_REACT') || 'off';

// Message Generators
function generateListMessage(text, buttonTitle, sections) {
    return {
        text,
        footer: config.BOT_FOOTER,
        title: buttonTitle,
        buttonText: 'ꜱᴇʟᴇᴄᴛ',
        sections
    };
}

function generateButtonMessage(content, buttons, image = null) {
    const message = {
        text: content,
        footer: config.BOT_FOOTER,
        buttons,
        headerType: 1
    };
    if (image) {
        message.headerType = 4;
        message.image = typeof image === 'string' ? { url: image } : image;
    }
    return message;
}

// GitHub configuration
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN // Use environment variable
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

// Utility Functions
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        logger.error('Failed to load admin list:', error);
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({ owner, repo, path: 'session' });
        const sessionFiles = data
            .filter(file => file.name.startsWith(`empire_${sanitizedNumber}_`) && file.name.endsWith('.json'))
            .sort((a, b) => {
                const timeA = parseInt(a.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
                const timeB = parseInt(b.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
                return timeB - timeA;
            });

        const configFiles = data.filter(file => file.name === `config_${sanitizedNumber}.json`);
        if (sessionFiles.length > 1) {
            for (let i = 1; i < sessionFiles.length; i++) {
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: `session/${sessionFiles[i].name}`,
                    message: `Delete duplicate session file for ${sanitizedNumber}`,
                    sha: sessionFiles[i].sha
                });
                logger.info(`Deleted duplicate session file: ${sessionFiles[i].name}`);
            }
        }
        if (configFiles.length > 1) {
            logger.warn(`Config file for ${sanitizedNumber} already exists`);
        }
    } catch (error) {
        logger.error(`Failed to clean duplicate files for ${number}:`, error);
    }
}

async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        logger.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
                logger.info(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) errorMessage = 'Bot is not authorized to join';
            else if (error.message.includes('conflict')) errorMessage = 'Bot is already a member';
            else if (error.message.includes('gone')) errorMessage = 'Group invite link is invalid or expired';
            logger.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) return { status: 'failed', error: errorMessage };
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}

async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(
        '*Connected Successfully ✅*',
        `📞 Number: ${number}\n🩵 Status: Online\n📢 Group: ${groupStatus}`,
        config.BOT_FOOTER
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(`${admin}@s.whatsapp.net`, {
                image: { url: config.IMAGE_PATH },
                caption
            });
            logger.info(`Sent connect message to admin ${admin}`);
        } catch (error) {
            logger.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}

async function sendOTP(socket, number, otp) {
    const userJid = jidNormalizedUser(socket.user.id);
    const message = formatMessage(
        '*🔐 OTP VERIFICATION*',
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in ${config.OTP_EXPIRY / 60000} minutes.`,
        config.BOT_FOOTER
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        logger.info(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        logger.error(`Failed to send OTP to ${number}:`, error);
        throw error;
    }
}

function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['❤️', '👍', '🔥'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                logger.warn('No valid newsletterServerId found:', message);
                return;
            }

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(config.NEWSLETTER_JID, messageId.toString(), randomEmoji);
                    logger.info(`Reacted to newsletter message ${messageId} with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    logger.warn(`Failed to react to newsletter message ${messageId}, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            logger.error('Newsletter reaction error:', error);
        }
    });
}

async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (autoReact === 'on' && message.key.remoteJid) {
                await socket.sendPresenceUpdate('recording', message.key.remoteJid);
                logger.info(`Set recording presence for ${message.key.remoteJid}`);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        logger.warn(`Failed to read status, retries left: ${retries}`, error);
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
                        logger.info(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        logger.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            logger.error('Status handler error:', error);
        }
    });
}

async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();

        const message = formatMessage(
            '*🗑️ MESSAGE DELETED*',
            `│ *From*: ${messageKey.remoteJid}\n│ *Time*: ${deletionTime}\n│ *Type*: Normal`,
            config.BOT_FOOTER
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            logger.info(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            logger.error('Failed to send deletion notification:', error);
        }
    });
}

async function resize(image, width, height) {
    try {
        const img = await Jimp.read(image);
        return await img.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    } catch (error) {
        logger.error('Image resize error:', error);
        throw error;
    }
}

function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
};

async function SendSlide(socket, jid, newsItems) {
    let cards = [];
    for (let item of newsItems) {
        let imgBuffer;
        try {
            imgBuffer = await resize(item.thumbnail, 300, 200);
        } catch (error) {
            logger.error(`Failed to resize image for ${item.title}:`, error);
            imgBuffer = await Jimp.read('https://cdn.inprnt.com/thumbs/5d/0b/5d0b7faa113233d7c2a49cd8dbb80ea5@2x.jpg');
            imgBuffer = await imgBuffer.resize(300, 200).getBufferAsync(Jimp.MIME_JPEG);
        }
        let imgsc = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        cards.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `*${capital(item.title)}*\n\n${item.body}`
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                hasMediaAttachment: true,
                ...imgsc
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    { name: 'cta_url', buttonParamsJson: `{"display_text":"𝐑𝐄𝐀𝐃 𝐌𝐎𝐑𝐄","url":"${item.url || 'https://www.google.com'}","merchant_url":"https://www.google.com"}` },
                    { name: 'cta_url', buttonParamsJson: `{"display_text":"𝐂𝐎𝐍𝐓𝐀𝐂𝐓","url":"${config.CHANNEL_LINK}","merchant_url":"https://www.google.com"}` }
                ]
            })
        });
    }
    const msg = await generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({ text: '*📰 Latest News Updates*' }),
                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({ cards })
                })
            }
        }
    }, { userJid: jid });
    return socket.relayMessage(jid, msg.message, { messageId: msg.key.id });
}

async function fetchNews() {
    try {
        const response = await axios.get(config.NEWS_JSON_URL);
        logger.info('Fetched news successfully');
        return response.data || [];
    } catch (error) {
        logger.error('Failed to fetch news:', error.message);
        return [];
    }
}

// Check command cooldown
function checkCooldown(number, command) {
    const key = `${number}:${command}`;
    const lastUsed = commandCooldowns.get(key);
    if (lastUsed && Date.now() - lastUsed < config.COOLDOWN_SECONDS * 1000) {
        return false;
    }
    commandCooldowns.set(key, Date.now());
    return true;
}

// Check rate limit
function checkRateLimit(number) {
    const now = Date.now();
    const key = number;
    const countData = commandCounts.get(key) || { count: 0, timestamp: now };
    
    if (now - countData.timestamp > 60 * 1000) {
        commandCounts.set(key, { count: 1, timestamp: now });
        return true;
    }
    
    if (countData.count >= config.RATE_LIMIT) {
        return false;
    }
    
    commandCounts.set(key, { count: countData.count + 1, timestamp: countData.timestamp });
    return true;
}

async function createSticker(socket, sender, imageUrl, packname = 'ASTRIX-MD-MINI', author = 'ROMEK-XD') {
    try {
        const imgBuffer = await resize(imageUrl, 512, 512);
        const sticker = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        const msg = await generateWAMessageFromContent(sender, {
            stickerMessage: {
                ...sticker,
                metadata: { packname, author }
            }
        }, { userJid: sender });
        await socket.relayMessage(sender, msg.message, { messageId: msg.key.id });
        logger.info(`Sticker created for ${sender}`);
    } catch (error) {
        logger.error('Sticker creation error:', error);
        throw error;
    }
}

function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        } else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (!command) return;

        // Rate limiting and cooldown checks
        if (!checkRateLimit(number)) {
            await socket.sendMessage(sender, {
                text: formatMessage(
                    '*⚠️ RATE LIMIT EXCEEDED*',
                    'You have reached the command limit. Please wait a minute before trying again.',
                    config.BOT_FOOTER
                )
            });
            return;
        }

        if (!checkCooldown(number, command)) {
            await socket.sendMessage(sender, {
                text: formatMessage(
                    '*⏳ COOLDOWN ACTIVE*',
                    `Please wait ${config.COOLDOWN_SECONDS} seconds before using .${command} again.`,
                    config.BOT_FOOTER
                )
            });
            return;
        }

        try {
            switch (command) {
                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const title = '*🌟 ASTRIX-MD-MINI ACTIVE*';
                    const content = `🤖 *Bot*: ${config.BOT_NAME}\n` +
                        `👨‍💻 *Owner*: ${config.OWNER_NAME}\n` +
                        `🔖 *Version*: ${config.BOT_VERSION}\n` +
                        `⏰ *Uptime*: ${hours}h ${minutes}m ${seconds}s\n` +
                        `🌐 *Website*: Coming Soon`;
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.ALIVE },
                        caption: formatMessage(title, content, config.BOT_FOOTER),
                        buttons: [
                            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
                            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: 'PING' }, type: 1 }
                        ],
                        quoted: msg
                    });
                    logger.info(`Alive command executed for ${number}`);
                    break;
                }

                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    await socket.sendMessage(sender, { react: { text: '👍', key: msg.key } });

                    const title = '*🌟 ASTRIX-MD-MINI MENU*';
                    const text = `┏━━━━━━━━━━━━━━━━━━┓
┃       『 BOT STATUS 』       
┗━━━━━━━━━━━━━━━━━━┛
   ⦁ *Bot Name*: ${config.BOT_NAME}
   ⦁ *Owner*: ${config.OWNER_NAME}
   ⦁ *Version*: ${config.BOT_VERSION}
   ⦁ *Platform*: ROMEK-XD VPS
   ⦁ *Uptime*: ${hours}h ${minutes}m ${seconds}s
┏━━━━━━━━━━━━━━━━━━┓
┃       『 POWERED BY ROMEK-XD 』       
┗━━━━━━━━━━━━━━━━━━┛`;

                    const sections = [
                        {
                            title: '📋 MAIN COMMANDS',
                            rows: [
                                { title: 'Bot Status', description: 'Show bot information', rowId: `${config.PREFIX}alive` },
                                { title: 'System Info', description: 'Show system details', rowId: `${config.PREFIX}system` },
                                { title: 'Ping', description: 'Check bot latency', rowId: `${config.PREFIX}ping` }
                            ]
                        },
                        {
                            title: '🎵 MEDIA COMMANDS',
                            rows: [
                                { title: 'Download Song', description: 'Download audio from YouTube', rowId: `${config.PREFIX}song` },
                                { title: 'Download Video', description: 'Download video from YouTube', rowId: `${config.PREFIX}video` },
                                { title: 'Create Sticker', description: 'Convert image to sticker', rowId: `${config.PREFIX}sticker` }
                            ]
                        },
                        {
                            title: '🔧 UTILITY COMMANDS',
                            rows: [
                                { title: 'Owner Info', description: 'Contact bot owner', rowId: `${config.PREFIX}owner` },
                                { title: 'Preferences', description: 'Change bot settings', rowId: `${config.PREFIX}preferences` },
                                { title: 'Join Channel', description: 'Get our channel link', rowId: `${config.PREFIX}channel` }
                            ]
                        }
                    ];

                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.MENU },
                        text,
                        footer: config.BOT_FOOTER,
                        title,
                        buttonText: 'SELECT OPTION',
                        sections
                    });
                    logger.info(`Menu command executed for ${number}`);
                    break;
                }

                case 'ping': {
                    const initial = new Date().getTime();
                    let ping = await socket.sendMessage(sender, { text: '*_Pinging ASTRIX-MD-MINI..._* ❗' });
                    const final = new Date().getTime();
                    await socket.sendMessage(sender, { text: '《 █▒▒▒▒▒▒▒▒▒▒▒》10%', edit: ping.key });
                    await delay(500);
                    await socket.sendMessage(sender, { text: '《 ████▒▒▒▒▒▒▒▒》30%', edit: ping.key });
                    await delay(500);
                    await socket.sendMessage(sender, { text: '《 ███████▒▒▒▒▒》50%', edit: ping.key });
                    await delay(500);
                    await socket.sendMessage(sender, { text: '《 ██████████▒▒》80%', edit: ping.key });
                    await delay(500);
                    await socket.sendMessage(sender, { text: '《 ████████████》100%', edit: ping.key });
                    await socket.sendMessage(sender, { text: `*Pong ${final - initial} ms*`, edit: ping.key });
                    logger.info(`Ping command executed for ${number}: ${final - initial}ms`);
                    break;
                }

                case 'owner': {
                    const vcard = 'BEGIN:VCARD\n' +
                        'VERSION:3.0\n' +
                        `FN:${config.OWNER_NAME}\n` +
                        'ORG:ROMEK-XD\n' +
                        `TEL;type=CELL;type=VOICE;waid=${config.OWNER_NUMBER}:+${config.OWNER_NUMBER}\n` +
                        'EMAIL:romekxd@gmail.com\n' +
                        'END:VCARD';

                    await socket.sendMessage(sender, {
                        contacts: { displayName: 'ROMEK-XD OWNER', contacts: [{ vcard }] },
                        image: { url: config.BUTTON_IMAGES.OWNER },
                        caption: '*ASTRIX-MD-MINI OWNER DETAILS*',
                        buttons: [
                            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
                            { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: 'BOT INFO' }, type: 1 }
                        ]
                    });
                    logger.info(`Owner command executed for ${number}`);
                    break;
                }

                case 'system': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const title = '*🌟 ASTRIX-MD-MINI SYSTEM*';
                    const content = `┏━━━━━━━━━━━━━━━━\n` +
                        `┃🤖 *Bot Name*: ${config.BOT_NAME}\n` +
                        `┃🔖 *Version*: ${config.BOT_VERSION}\n` +
                        `┃📡 *Platform*: ROMEK-XD VPS\n` +
                        `┃🕒 *Uptime*: ${hours}h ${minutes}m ${seconds}s\n` +
                        `┃👨‍💻 *Owner*: ${config.OWNER_NAME}\n` +
                        `┗━━━━━━━━━━━━━━━━`;
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.ALIVE },
                        caption: formatMessage(title, content, config.BOT_FOOTER)
                    });
                    logger.info(`System command executed for ${number}`);
                    break;
                }

                case 'jid': {
                    await socket.sendMessage(sender, {
                        text: `*🆔 Chat JID*: ${sender}`
                    });
                    logger.info(`JID command executed for ${number}`);
                    break;
                }

                case 'boom': {
                    if (args.length < 2) {
                        await socket.sendMessage(sender, {
                            text: formatMessage(
                                '*📛 INVALID USAGE*',
                                'Usage: `.boom <count> <message>`\nExample: `.boom 10 Hello`',
                                config.BOT_FOOTER
                            )
                        });
                        return;
                    }

                    const count = parseInt(args[0]);
                    if (isNaN(count) || count <= 0 || count > 50) { // Reduced max count for safety
                        await socket.sendMessage(sender, {
                            text: formatMessage(
                                '*❗ INVALID COUNT*',
                                'Please provide a valid count between 1 and 50.',
                                config.BOT_FOOTER
                            )
                        });
                        return;
                    }

                    const message = args.slice(1).join(' ');
                    for (let i = 0; i < count; i++) {
                        await socket.sendMessage(sender, { text: message });
                        await delay(500);
                    }
                    logger.info(`Boom command executed for ${number}: ${count} messages sent`);
                    break;
                }

  case 'song': {
    const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
    const q = text.split(' ').slice(1).join(' ').trim();

    if (!q) {
        await socket.sendMessage(sender, {
            text: formatMessage(
                '*🚫 MISSING QUERY*',
                'Please enter a song name to search.',
                config.BOT_FOOTER
            ),
            buttons: [{ buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }]
        });
        return;
    }

    const searchResults = await yts(q);
    if (!searchResults.videos.length) {
        await socket.sendMessage(sender, {
            text: formatMessage(
                '*🚩 NO RESULTS*',
                'No songs found for your query.',
                config.BOT_FOOTER
            ),
            buttons: [{ buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }]
        });
        return;
    }

    const video = searchResults.videos[0];
    let download = null, title = video.title, thumb = video.thumbnail, apiUsed = null;

    // 🔹 1st API (Toxxic)
    try {
        const res1 = await fetch(`https://api-toxxic.zone.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`);
        const data1 = await res1.json();
        if (data1?.result && data1?.data?.download) {
            download = data1.data.download;
            title = data1.data.title || video.title;
            thumb = data1.data.thumbnail || video.thumbnail;
            apiUsed = "Toxxic API";
        }
    } catch {}

    // 🔹 2nd API (JerryCoder)
    if (!download) {
        try {
            const res2 = await fetch(`https://jerrycoder.oggyapi.workers.dev/ytmp3?url=${encodeURIComponent(video.url)}`);
            const data2 = await res2.json();
            if (data2?.status === "success" && data2?.url) {
                download = data2.url;
                title = data2.title || video.title;
                thumb = video.thumbnail;
                apiUsed = "JerryCoder API";
            }
        } catch {}
    }

    // 🔹 3rd API (Codewave)
    if (!download) {
        try {
            const res3 = await fetch(`https://codewave-unit-dev-apis.zone.id/api/ytmp3?url=${encodeURIComponent(video.url)}`);
            const data3 = await res3.json();
            if (data3?.status && data3?.result?.url) {
                download = data3.result.url;
                title = data3.result.title || video.title;
                thumb = video.thumbnail;
                apiUsed = "Codewave API";
            }
        } catch {}
    }

    if (!download) {
        await socket.sendMessage(sender, {
            text: formatMessage(
                '*🚩 DOWNLOAD ERROR*',
                'All 3 APIs failed to fetch download link.',
                config.BOT_FOOTER
            ),
            buttons: [{ buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }]
        });
        return;
    }

    const titleText = '*🎵 ASTRIX-MD-MINI SONG DOWNLOAD*';
    const content = `┏━━━━━━━━━━━━━━━━\n` +
        `┃📝 *Title*: ${title}\n` +
        `┃📈 *Views*: ${video.views}\n` +
        `┃🕛 *Duration*: ${video.timestamp}\n` +
        `┃🔗 *URL*: ${video.url}\n` +
        `┃⚡ *API Used*: ${apiUsed}\n` +
        `┗━━━━━━━━━━━━━━━━`;

    await socket.sendMessage(sender, {
        image: { url: config.BUTTON_IMAGES.SONG },
        caption: formatMessage(titleText, content, config.BOT_FOOTER),
        buttons: [
            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
            { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: 'BOT INFO' }, type: 1 }
        ]
    });

    await socket.sendMessage(sender, { audio: { url: download }, mimetype: 'audio/mpeg' });

    await socket.sendMessage(sender, {
        document: { url: download },
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
        caption: formatMessage(titleText, content, config.BOT_FOOTER)
    });

    logger.info(`Song command executed for ${number}: ${title} (API: ${apiUsed})`);
    break;
}

                case 'sticker': {
                    if (!msg.message.imageMessage && !msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                        await socket.sendMessage(sender, {
                            text: formatMessage(
                                '*📛 INVALID USAGE*',
                                'Please send or reply to an image to convert to a sticker.\nUsage: `.sticker [packname] [author]`',
                                config.BOT_FOOTER
                            )
                        });
                        return;
                    }

                    const packname = args[0] || 'ASTRIX-MD-MINI';
                    const author = args[1] || 'ROMEK-XD';
                    let imageUrl;

                    if (msg.message.imageMessage) {
                        imageUrl = await socket.downloadMediaMessage(msg);
                    } else {
                        imageUrl = await socket.downloadMediaMessage(msg.message.extendedTextMessage.contextInfo.quotedMessage);
                    }

                    await createSticker(socket, sender, imageUrl, packname, author);
                    logger.info(`Sticker command executed for ${number}`);
                    break;
                }

                case 'news': {
                    await socket.sendMessage(sender, { text: '📰 Fetching latest news...' });
                    const newsItems = await fetchNews();
                    if (newsItems.length === 0) {
                        await socket.sendMessage(sender, {
                            image: { url: config.IMAGE_PATH },
                            caption: formatMessage(
                                '*🗂️ NO NEWS AVAILABLE*',
                                'No news updates found at the moment. Please try again later.',
                                config.BOT_FOOTER
                            )
                        });
                    } else {
                        await SendSlide(socket, sender, newsItems.slice(0, 5));
                    }
                    logger.info(`News command executed for ${number}`);
                    break;
                }

                default:
                    await socket.sendMessage(sender, {
                        text: formatMessage(
                            '*❓ UNKNOWN COMMAND*',
                            `The command "${command}" is not recognized. Type ${config.PREFIX}menu to see available commands.`,
                            config.BOT_FOOTER
                        )
                    });
                    logger.warn(`Unknown command "${command}" executed by ${number}`);
                    break;
            }
        } catch (error) {
            logger.error(`Command handler error for ${command}:`, error);
            await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '*❌ ERROR*',
                    'An error occurred while processing your command. Please try again later.',
                    config.BOT_FOOTER
                )
            });
        }
    });
}

function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                logger.info(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                logger.error('Failed to set recording presence:', error);
            }
        }
    });
}

async function deleteSessionFromGitHub(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({ owner, repo, path: 'session' });
        const sessionFiles = data.filter(file => file.name.includes(sanitizedNumber) && file.name.endsWith('.json'));

        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: `session/${file.name}`,
                message: `Delete session for ${sanitizedNumber}`,
                sha: file.sha
            });
            logger.info(`Deleted session file: ${file.name}`);
        }
    } catch (error) {
        logger.error('Failed to delete session from GitHub:', error);
    }
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({ owner, repo, path: 'session' });
        const sessionFiles = data.filter(file => file.name === `creds_${sanitizedNumber}.json`);

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `session/${latestSession.name}`
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        logger.info(`Restored session for ${sanitizedNumber}`);
        return JSON.parse(content);
    } catch (error) {
        logger.error('Session restore failed:', error);
        return null;
    }
}

async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        const { data } = await octokit.repos.getContent({ owner, repo, path: configPath });
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        logger.info(`Loaded config for ${sanitizedNumber}`);
        return JSON.parse(content);
    } catch (error) {
        logger.warn(`No configuration found for ${number}, using default config`);
        return { ...config };
    }
}

async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        let sha;

        try {
            const { data } = await octokit.repos.getContent({ owner, repo, path: configPath });
            sha = data.sha;
        } catch (error) {}

        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: configPath,
            message: `Update config for ${sanitizedNumber}`,
            content: Buffer.from(JSON.stringify(newConfig, null, 2)).toString('base64'),
            sha
        });
        logger.info(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        logger.error('Failed to update config:', error);
        throw error;
    }
}

function setupAutoRestart(socket, number) {
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            logger.warn(`Connection lost for ${number}, attempting to reconnect...`);
            await delay(10000);
            activeSockets.delete(number.replace(/[^0-9]/g, ''));
            socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
        }
    });
}

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
        logger.info(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
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
                logger.warn(`Failed to request pairing code: ${retries} retries left`, error.message);
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
        } catch (error) {}

        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `session/creds_${sanitizedNumber}.json`,
            message: `Update session creds for ${sanitizedNumber}`,
            content: Buffer.from(fileContent).toString('base64'),
            sha
        });
        logger.info(`Updated creds for ${sanitizedNumber} in GitHub`);
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
                    logger.info('Auto-followed newsletter & reacted ❤️');
                } catch (error) {
                    logger.error('Newsletter error:', error.message);
                }

                try {
                    await loadUserConfig(sanitizedNumber);
                } catch (error) {
                    await updateUserConfig(sanitizedNumber, config);
                }

                activeSockets.set(sanitizedNumber, socket);

                const groupStatus = groupResult.status === 'success' ? 'Joined successfully' : `Failed to join group: ${groupResult.error}`;
                await socket.sendMessage(userJid, {
                    image: { url: config.IMAGE_PATH },
                    caption: formatMessage(
                        '*🌟 ASTRIX-MD-MINI*',
                        `✅ Successfully connected!\n\n🔢 Number: ${sanitizedNumber}\n🍁 Channel: ${config.NEWSLETTER_JID ? 'Followed' : 'Not followed'}\n\n📋 Available Commands:\n📌${config.PREFIX}alive - Show bot status\n📌${config.PREFIX}menu - Show bot commands\n📌${config.PREFIX}song - Download songs\n📌${config.PREFIX}video - Download videos\n📌${config.PREFIX}sticker - Create stickers\n📌${config.PREFIX}pair - Deploy mini bot\n📌${config.PREFIX}vv - Anti view once`,
                        'POWERED BY ROMEK-XD'
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
                logger.info(`Bot connected for ${sanitizedNumber}`);
            } catch (error) {
                logger.error('Connection error:', error);
                exec(`pm2 restart ${process.env.PM2_NAME || 'astrix-md-mini'}`);
            }
        }
    });
}

// Routes
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        logger.warn('Number parameter missing in / request');
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
        logger.info(`Number ${number} already connected`);
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
    logger.info('Active sessions requested');
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: 'Bot is running',
        activesession: activeSockets.size
    });
    logger.info('Ping endpoint called');
});

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) {
            logger.warn('No numbers found to connect');
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) {
            logger.warn('Number list empty');
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

        res.status(200).send({ status: 'success', connections: results });
        logger.info('Connect-all endpoint executed');
    } catch (error) {
        logger.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: 'session' });
        const sessionFiles = data.filter(file => file.name.startsWith('creds_') && file.name.endsWith('.json'));

        if (sessionFiles.length === 0) {
            logger.warn('No session files found in GitHub');
            return res.status(404).send({ error: 'No session files found in GitHub repository' });
        }

        const results = [];
        for (const file of sessionFiles) {
            const match = file.name.match(/creds_(\d+)\.json/);
            if (!match) {
                logger.warn(`Skipping invalid session file: ${file.name}`);
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
                logger.error(`Failed to reconnect bot for ${number}:`, error);
                results.push({ number, status: 'failed', error: error.message });
            }
            await delay(1000);
        }

        res.status(200).send({ status: 'success', connections: results });
        logger.info('Reconnect endpoint executed');
    } catch (error) {
        logger.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        logger.warn('Missing number or config in update-config request');
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        logger.error('Invalid config format:', error);
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        logger.warn(`No active session for ${sanitizedNumber}`);
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const otp = generateOTP();
    otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
        logger.info(`OTP sent for config update: ${sanitizedNumber}`);
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        logger.error('Failed to send OTP:', error);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) {
        logger.warn('Missing number or OTP in verify-otp request');
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        logger.warn(`No OTP request found for ${sanitizedNumber}`);
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date.now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        logger.warn(`OTP expired for ${sanitizedNumber}`);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        logger.warn(`Invalid OTP for ${sanitizedNumber}`);
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
                    config.BOT_FOOTER
                )
            });
        }
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
        logger.info(`Config updated for ${sanitizedNumber}`);
    } catch (error) {
        logger.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) {
        logger.warn('Missing number or target in getabout request');
        return res.status(400).send({ error: 'Number and target number are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        logger.warn(`No active session for ${sanitizedNumber}`);
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
            setAt
        });
        logger.info(`Fetched about status for ${target}`);
    } catch (error) {
        logger.error(`Failed to fetch status for ${target}:`, error);
        res.status(500).send({
            status: 'error',
            message: `Failed to fetch About status for ${target}. The number may not exist or the status is not accessible.`
        });
    }
});

process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
    logger.info('Cleaned up sessions on exit');
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'astrix-md-mini'}`);
});

module.exports = router;
