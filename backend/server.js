require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Global Rate Limiter: Max 5 requests per 15 minutes for OTP endpoints
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, 
    message: { success: false, message: 'Too many requests, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Temporary in-memory storage for OTPs (In production, use Redis or a Database)
const otpStorage = {};

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Endpoint to send OTP
 */
app.post('/api/send-otp', otpLimiter, async (req, res) => {
    let { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Clean the phone number: remove any non-digit characters (like '+', '(', ')', '-', ' ')
    phone = phone.replace(/\D/g, '');

    if (phone.length < 10) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format' });
    }

    // Check if an OTP was sent recently (Cooldown of 1 minute)
    const existing = otpStorage[phone];
    if (existing && Date.now() - existing.lastSentAt < 60 * 1000) {
        const remaining = Math.ceil((60 * 1000 - (Date.now() - existing.lastSentAt)) / 1000);
        return res.status(429).json({ success: false, message: `Please wait ${remaining} seconds before requesting a new code.` });
    }

    const otp = generateOTP();
    otpStorage[phone] = {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000, // Expires in 5 minutes
        lastSentAt: Date.now()
    };

    console.log(`Generated OTP for ${phone}: ${otp}`);

    try {
        const response = await axios.post('https://api.mobizon.kz/service/message/sendSMSMessage', null, {
            params: {
                output: 'json',
                api: 'v1',
                apiKey: process.env.MOBIZON_API_KEY,
                recipient: phone,
                text: `Roomie.kz - Your verification code is: ${otp}. Valid for 5 minutes.`
            }
        });

        console.log('Mobizon API Response:', JSON.stringify(response.data, null, 2));

        if (response.data.code === 0) {
            res.json({ success: true, message: 'OTP sent successfully', messageId: response.data.data.messageId });
        } else {
            console.error('Mobizon Error Details:', response.data);
            res.status(500).json({ success: false, message: `Mobizon Error: ${response.data.message || 'Unknown error'}` });
        }
    } catch (error) {
        console.error('Request Error:', error.message);
        res.status(500).json({ success: false, message: 'Error connecting to SMS provider' });
    }
});

/**
 * Endpoint to verify OTP
 */
app.post('/api/verify-otp', (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const storedData = otpStorage[phone];

    if (!storedData) {
        return res.status(400).json({ success: false, message: 'No OTP found for this number' });
    }

    if (Date.now() > storedData.expiresAt) {
        delete otpStorage[phone];
        return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    if (storedData.otp === otp) {
        delete otpStorage[phone]; // Clear OTP after successful verification
        res.json({ success: true, message: 'Verification successful!' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
