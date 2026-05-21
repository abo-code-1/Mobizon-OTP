import { useState } from 'react';
import axios from 'axios';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import './App.css';

function App() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Enter Phone, 2: Enter OTP
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [countdown, setCountdown] = useState(0);

  const backendUrl = 'http://localhost:5001/api';

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!phone || phone.length < 10) {
      setMessage({ text: 'Please enter a valid phone number.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const response = await axios.post(`${backendUrl}/send-otp`, { phone });
      if (response.data.success) {
        setStep(2);
        setMessage({ text: 'OTP sent! Please check your phone.', type: 'success' });
        startCountdown();
      }
    } catch (error) {
      setMessage({ 
        text: error.response?.data?.message || 'Failed to send OTP. Try again.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const response = await axios.post(`${backendUrl}/verify-otp`, { phone, otp });
      if (response.data.success) {
        setMessage({ text: 'Verification Successful! 🎉', type: 'success' });
        setStep(3); // Success state
      }
    } catch (error) {
      setMessage({ 
        text: error.response?.data?.message || 'Invalid OTP. Please try again.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>OTP Verification</h1>
      
      {message.text && (
        <div className={`alert ${message.type}`}>
          {message.text}
        </div>
      )}

      {step === 1 && (
        <div className="phone-input-container">
          <p>Enter your phone number to receive a verification code.</p>
          <PhoneInput
            country={'kz'}
            value={phone}
            onChange={setPhone}
            inputStyle={{ width: '100%', height: '45px' }}
            containerStyle={{ marginBottom: '1rem' }}
          />
          <button onClick={sendOtp} disabled={loading || countdown > 0}>
            {loading ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Send OTP'}
          </button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={verifyOtp}>
          <p>We've sent a code to <strong>{phone}</strong></p>
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength="6"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          
          <div className="resend-container">
            {countdown > 0 ? (
              <p className="timer">Didn't get the code? Resend in {countdown}s</p>
            ) : (
              <button 
                type="button" 
                className="secondary" 
                onClick={sendOtp}
                disabled={loading}
              >
                Resend OTP
              </button>
            )}
          </div>

          <button 
            type="button" 
            className="secondary" 
            onClick={() => {
              setStep(1);
              setOtp('');
            }}
          >
            Change Phone Number
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="success-view">
          <h2>Welcome!</h2>
          <p>You have successfully verified your phone number.</p>
          <button onClick={() => {
            setStep(1);
            setPhone('');
            setOtp('');
            setMessage({ text: '', type: '' });
          }}>
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
