import React, { useState, useEffect } from 'react';
import config from '../config';
import AdminLayout from '../components/AdminLayout';
import PhoneVerification from '../components/PhoneVerification';
import { useNotifications } from '../services/notificationService';

const SMSDemo = () => {
  const [activeDemo, setActiveDemo] = useState('otp');
  const [serviceStatus, setServiceStatus] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const notifications = useNotifications();

  // Load service status on mount
  useEffect(() => {
    loadServiceStatus();
  }, []);

  const loadServiceStatus = async () => {
    try {
      const status = await notifications.getServiceStatus();
      setServiceStatus(status);
    } catch (error) {
  }
  };

  // Handle OTP verification completion
  const handleOTPVerified = (result) => {
    setTestResults(prev => [...prev, {
      type: 'OTP Verification',
      status: 'success',
      message: `Phone ${result.phoneNumber} verified successfully`,
      timestamp: new Date().toISOString()
    }]);
    alert('Phone verification completed successfully!');
  };

  // Test order confirmation
  const testOrderConfirmation = async () => {
    const phoneNumber = prompt('Enter phone number for order confirmation test:');
    if (!phoneNumber) return;

    setIsLoading(true);
    try {
      await notifications.sendOrderConfirmation({
        customerPhone: phoneNumber,
        customerName: 'John Doe',
        orderId: 'ORD-' + Math.random().toString(36).substr(2, 9),
        totalAmount: 299.50,
        deliveryTime: '15-20 minutes',
        theaterName: 'YQPayNow Theater'
      });

      setTestResults(prev => [...prev, {
        type: 'Order Confirmation',
        status: 'success',
        message: `Order confirmation sent to ${phoneNumber}`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      setTestResults(prev => [...prev, {
        type: 'Order Confirmation',
        status: 'error',
        message: `Failed to send: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Test order ready notification
  const testOrderReady = async () => {
    const phoneNumber = prompt('Enter phone number for order ready test:');
    if (!phoneNumber) return;

    setIsLoading(true);
    try {
      await notifications.sendOrderReady({
        customerPhone: phoneNumber,
        customerName: 'Jane Smith',
        orderId: 'ORD-' + Math.random().toString(36).substr(2, 9),
        theaterName: 'YQPayNow Theater'
      });

      setTestResults(prev => [...prev, {
        type: 'Order Ready',
        status: 'success',
        message: `Order ready notification sent to ${phoneNumber}`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      setTestResults(prev => [...prev, {
        type: 'Order Ready',
        status: 'error',
        message: `Failed to send: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Test payment success
  const testPaymentSuccess = async () => {
    const phoneNumber = prompt('Enter phone number for payment success test:');
    if (!phoneNumber) return;

    setIsLoading(true);
    try {
      await notifications.sendPaymentSuccess({
        customerPhone: phoneNumber,
        customerName: 'Alex Johnson',
        orderId: 'ORD-' + Math.random().toString(36).substr(2, 9),
        amount: 450.75,
        paymentMethod: 'UPI'
      });

      setTestResults(prev => [...prev, {
        type: 'Payment Success',
        status: 'success',
        message: `Payment success notification sent to ${phoneNumber}`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      setTestResults(prev => [...prev, {
        type: 'Payment Success',
        status: 'error',
        message: `Failed to send: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Test custom message
  const testCustomMessage = async () => {
    const phoneNumber = prompt('Enter phone number for custom message:');
    if (!phoneNumber) return;
    
    const message = prompt('Enter custom message (max 160 characters):');
    if (!message) return;

    setIsLoading(true);
    try {
      await notifications.sendCustomNotification(phoneNumber, message);

      setTestResults(prev => [...prev, {
        type: 'Custom Message',
        status: 'success',
        message: `Custom message sent to ${phoneNumber}`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      setTestResults(prev => [...prev, {
        type: 'Custom Message',
        status: 'error',
        message: `Failed to send: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  return (
    <AdminLayout pageTitle="SMS Demo" currentPage="sms-demo">
      <div className="sms-demo">
        {/* Service Status */}
        <div className="status-card">
          <h3>SMS Service Status</h3>
          {serviceStatus ? (
            <div className="status-grid">
              <div className="status-item">
                <span>Service Available:</span>
                <span className={serviceStatus.smsService.isAvailable ? 'status-yes' : 'status-no'}>
                  {serviceStatus.smsService.isAvailable ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="status-item">
                <span>Provider:</span>
                <span>{serviceStatus.smsService.provider.toUpperCase()}</span>
              </div>
              <div className="status-item">
                <span>Active OTPs:</span>
                <span>{serviceStatus.otpService.activeOTPs}</span>
              </div>
              <div className="status-item">
                <span>Total Sent:</span>
                <span>{serviceStatus.otpService.totalOTPs}</span>
              </div>
            </div>
          ) : (
            <p>Loading status...</p>
          )}
          <button onClick={loadServiceStatus} className="btn-secondary">
            Refresh Status
          </button>
        </div>

        {/* Demo Tabs */}
        <div className="demo-tabs">
          <button
            className={`tab-btn ${activeDemo === 'otp' ? 'active' : ''}`}
            onClick={() => setActiveDemo('otp')}
          >
            OTP Verification
          </button>
          <button
            className={`tab-btn ${activeDemo === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveDemo('notifications')}
          >
            Notifications
          </button>
        </div>

        {/* Demo Content */}
        <div className="demo-content">
          {activeDemo === 'otp' && (
            <div className="otp-demo">
              <h3>Phone Number Verification Demo</h3>
              <p>Test the OTP verification flow with your phone number:</p>
              
              <PhoneVerification
                onVerificationComplete={handleOTPVerified}
                title="Test Phone Verification"
                subtitle="Enter your phone number to receive a test OTP"
                purpose="demo"
              />
            </div>
          )}

          {activeDemo === 'notifications' && (
            <div className="notifications-demo">
              <h3>SMS Notifications Demo</h3>
              <p>Test different types of SMS notifications:</p>
              
              <div className="notification-buttons">
                <button
                  onClick={testOrderConfirmation}
                  disabled={isLoading}
                  className="btn-primary"
                >
                  Test Order Confirmation
                </button>
                
                <button
                  onClick={testOrderReady}
                  disabled={isLoading}
                  className="btn-primary"
                >
                  Test Order Ready
                </button>
                
                <button
                  onClick={testPaymentSuccess}
                  disabled={isLoading}
                  className="btn-primary"
                >
                  Test Payment Success
                </button>
                
                <button
                  onClick={testCustomMessage}
                  disabled={isLoading}
                  className="btn-primary"
                >
                  Test Custom Message
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="test-results">
            <div className="results-header">
              <h3>Test Results</h3>
              <button onClick={clearTestResults} className="btn-secondary">
                Clear Results
              </button>
            </div>
            
            <div className="results-list">
              {testResults.map((result, index) => (
                <div key={index} className={`result-item ${result.status}`}>
                  <div className="result-header">
                    <span className="result-type">{result.type}</span>
                    <span className="result-time">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="result-message">{result.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .sms-demo {
          max-width: 800px;
          margin: 0 auto;
          padding: 24px;
        }

        .status-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .status-card h3 {
          margin: 0 0 16px 0;
          color: #1e293b;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .status-yes {
          color: #22c55e;
          font-weight: 600;
        }

        .status-no {
          color: #ef4444;
          font-weight: 600;
        }

        .demo-tabs {
          display: flex;
          background: #f1f5f9;
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 32px;
        }

        .tab-btn {
          flex: 1;
          padding: 12px 24px;
          background: none;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn.active {
          background: white;
          color: #8b5cf6;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .demo-content {
          background: white;
          border-radius: 12px;
          padding: 32px;
          margin-bottom: 32px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .demo-content h3 {
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        .demo-content p {
          margin: 0 0 24px 0;
          color: #64748b;
        }

        .notification-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .btn-primary, .btn-secondary {
          padding: 16px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #8b5cf6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #7c3aed;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }

        .test-results {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .results-header h3 {
          margin: 0;
          color: #1e293b;
        }

        .results-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .result-item {
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid;
        }

        .result-item.success {
          background: #f0fdf4;
          border-color: #22c55e;
        }

        .result-item.error {
          background: #fef2f2;
          border-color: #ef4444;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .result-type {
          font-weight: 600;
          color: #1e293b;
        }

        .result-time {
          font-size: 14px;
          color: #64748b;
        }

        .result-message {
          color: #374151;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .sms-demo {
            padding: 16px;
          }

          .notification-buttons {
            grid-template-columns: 1fr;
          }

          .demo-content {
            padding: 24px 16px;
          }
        }
      `}</style>
    </AdminLayout>
  );
};

export default SMSDemo;