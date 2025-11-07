import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../../config';
import '../../styles/customer/CustomerPhoneEntry.css';

const CustomerPhoneEntry = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get checkout data from navigation state
  const checkoutData = location.state;

  // Country code is fixed to India (+91)
  const countryCode = '+91';

  useEffect(() => {
    // Auto-focus on phone input when page loads
    const phoneInput = document.getElementById('phone-input');
    if (phoneInput) {
      phoneInput.focus();
    }
  }, []);

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 10) {
      setPhoneNumber(value);
      setError('');
    }
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[0-9]\d{9}$/; // 10-digit number format
    return phoneRegex.test(phone);
  };

  const handleContinue = async () => {

    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    const isValid = validatePhoneNumber(phoneNumber);

    if (!isValid) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhoneNumber = countryCode + phoneNumber;

      // Call actual API to send OTP - Use dynamic API URL
      const apiUrl = `${config.api.baseUrl}/sms/send-otp`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: fullPhoneNumber,
          purpose: 'order_verification'
        })
      });

      const result = await response.json();

      if (result.success) {

        // Navigate to OTP verification page with phone number
        navigate('/customer/otp-verification', { 
          state: { 
            phoneNumber: fullPhoneNumber,
            otpLength: result.data?.otpLength || 4,
            expiresIn: result.data?.expiresIn || 300
          }
        });
      } else {
        setError(result.error || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {

      setError('Failed to send OTP. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMenu = () => {
    // Navigate back to cart with checkout data
    navigate(-1); // Go back to previous page (cart)
  };

  const formatPhoneDisplay = (phone) => {
    if (phone.length >= 5) {
      return `${phone.slice(0, 5)} ${phone.slice(5)}`;
    }
    return phone;
  };

  return (
    <div className="phone-entry-page">
      <div className="phone-entry-header">
        <button 
          className="back-button"
          onClick={handleBackToMenu}
          type="button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="phone-entry-title">Phone Verification</h1>
      </div>

      <div className="phone-entry-content">
        <div className="phone-entry-card">
          <h2>Enter Your Mobile Number</h2>
          <p>We'll send you a 4-digit verification code to complete your order</p>

          <div className="phone-input-container">
            <div className="country-code-display">
              <span>🇮🇳</span>
              <span>{countryCode}</span>
            </div>
            
            <div className="phone-input-wrapper">
              <input
                id="phone-input"
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="Enter 10-digit number"
                className="phone-input"
                maxLength="10"
                autoComplete="tel"
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            className="continue-button"
            onClick={handleContinue}
            disabled={loading || phoneNumber.length !== 10}
          >
            {loading ? 'Sending OTP...' : 'Continue'}
          </button>

          <p className="security-text">
            Your phone number is safe and secure with us
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerPhoneEntry;