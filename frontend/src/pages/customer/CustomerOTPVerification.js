import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../../config';
import '../../styles/customer/CustomerOTPVerification.css';

const CustomerOTPVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  const phoneNumber = location.state?.phoneNumber || '';

  useEffect(() => {
    // Redirect back if no phone number
    if (!phoneNumber) {
      navigate('/customer/phone-entry');
      return;
    }

    // Auto-focus first OTP input
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phoneNumber, navigate]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Prevent multiple characters
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 4 digits entered
    if (value && newOtp.every(digit => digit !== '')) {
      setTimeout(() => handleVerifyOtp(newOtp), 500);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    
    setOtp(newOtp);
    
    // Focus last filled input or next empty input
    const lastIndex = Math.min(pastedData.length - 1, 3);
    inputRefs.current[lastIndex]?.focus();

    // Auto-verify if 4 digits pasted
    if (pastedData.length === 4) {
      setTimeout(() => handleVerifyOtp(newOtp), 500);
    }
  };

  const handleVerifyOtp = async (otpToVerify = otp) => {
    const otpString = otpToVerify.join('');
    
    if (otpString.length !== 4) {
      setError('Please enter complete 4-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔍 Verifying OTP:', otpString);
      console.log('📞 Phone:', phoneNumber);
      
      // Call actual API to verify OTP - Use dynamic API URL
      const apiUrl = `${config.api.baseUrl}/sms/verify-otp`;
      console.log('🌐 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          otp: otpString,
          purpose: 'order_verification'
        })
      });

      const result = await response.json();
      console.log('📥 Verification Response:', result);

      if (result.success) {
        console.log('✅ OTP verified successfully!');
        
        // Save phone number to localStorage for order history
        localStorage.setItem('customerPhone', phoneNumber);
        
        // Navigate to payment page
        navigate('/customer/payment', { 
          state: { 
            phoneNumber,
            verified: true 
          }
        });
      } else {
        setError(result.error || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('❌ Verification Error:', err);
      setError('Failed to verify OTP. Please try again.');
      setOtp(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;

    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Resending OTP to:', phoneNumber);
      
      // Call API to resend OTP - Use dynamic API URL
      const apiUrl = `${config.api.baseUrl}/sms/send-otp`;
      console.log('🌐 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          purpose: 'order_verification'
        })
      });

      const result = await response.json();
      console.log('📥 Resend Response:', result);

      if (result.success) {
        console.log('✅ OTP resent successfully!');
        
        // Reset timer
        setResendTimer(30);
        setCanResend(false);
        
        // Clear OTP inputs
        setOtp(['', '', '', '']);
        inputRefs.current[0]?.focus();

        // Start new countdown
        const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      } else {
        console.error('❌ Failed to resend OTP:', result.message);
        setError(result.message || 'Failed to resend OTP. Please try again.');
      }

    } catch (err) {
      console.error('❌ Resend OTP Error:', err);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/customer/phone-entry');
  };

  const formatPhoneNumber = (phone) => {
    if (phone.startsWith('+91')) {
      const number = phone.slice(3);
      return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
    }
    return phone;
  };

  return (
    <div className="otp-verification-page">
      <div className="otp-header">
        <button 
          className="back-button"
          onClick={handleBack}
          type="button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="otp-title">Verify OTP</h1>
      </div>

      <div className="otp-content">
        <div className="otp-card">
          <h2>Enter Verification Code</h2>
          <p>
            We've sent a 4-digit code to
            <br />
            <span className="phone-number-display">{formatPhoneNumber(phoneNumber)}</span>
          </p>

          <div className="otp-input-container">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className={`otp-input ${digit ? 'filled' : ''}`}
                maxLength="1"
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            className="verify-button"
            onClick={() => handleVerifyOtp()}
            disabled={loading || !otp.every(digit => digit !== '')}
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <div className="resend-section">
            {!canResend ? (
              <p className="resend-text">
                Resend OTP in <span className="timer">{resendTimer}s</span>
              </p>
            ) : (
              <button 
                className="resend-button"
                onClick={handleResendOtp}
                disabled={loading}
              >
                Resend OTP
              </button>
            )}
          </div>

          <div className="change-number-section">
            <span className="change-number-text">Wrong number?</span>
            <button 
              className="change-number-button"
              onClick={handleBack}
              type="button"
            >
              Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerOTPVerification;