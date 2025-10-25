import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../../config/index';
import '../../styles/customer/CustomerOrderHistory.css';

const CustomerOrderHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { theaterId, theaterName, phoneNumber } = location.state || {};

  useEffect(() => {
    // Get phone number from state or localStorage
    const phone = phoneNumber || localStorage.getItem('customerPhone');
    
    if (!theaterId) {
      console.error('Missing theater ID');
      navigate('/customer/home');
      return;
    }
    
    if (!phone) {
      console.error('Missing phone number');
      // Redirect to home if no phone number
      navigate('/customer/home');
      return;
    }
    
    fetchOrderHistory(phone);
  }, [theaterId, phoneNumber, navigate]);

  const fetchOrderHistory = async (phone) => {
    try {
      setLoading(true);
      console.log('📞 Fetching orders for phone:', phone);
      console.log('🎭 Theater ID:', theaterId);

      const response = await fetch(
        `${config.api.baseUrl}/orders/theater/${theaterId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      console.log('📦 All theater orders:', data);

      // Filter orders by phone number
      const customerOrders = data.orders.filter(order => 
        order.customerInfo?.phone === phone
      );

      console.log('✅ Customer orders:', customerOrders);
      
      // Sort by date (newest first)
      const sortedOrders = customerOrders.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      setOrders(sortedOrders);
    } catch (err) {
      console.error('❌ Error fetching orders:', err);
      setError('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const formatPrice = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('en-IN', options);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ff9800',
      preparing: '#2196f3',
      ready: '#4caf50',
      completed: '#4caf50',
      cancelled: '#f44336'
    };
    return colors[status] || '#666';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pending',
      preparing: 'Preparing',
      ready: 'Ready',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return texts[status] || status;
  };

  if (loading) {
    return (
      <div className="order-history-page">
        <div className="loading-container">
          <div className="loading-image-wrapper">
            <div className="loading-circle"></div>
            <img 
              src="/images/delivery-animation.png" 
              alt="Loading" 
              className="loading-image"
              onError={(e) => {
                // Fallback to emoji if image doesn't exist
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'block';
              }}
            />
            <div className="loading-emoji" style={{ display: 'none' }}>🍕</div>
          </div>
          <h3 className="loading-title">Loading your orders...</h3>
          <p className="loading-subtitle">Food you 🧡, on time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-history-page">
      <div className="order-history-header">
        <button 
          className="back-button"
          onClick={handleBack}
          type="button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="header-content">
          <h1 className="page-title">Order History</h1>
          {theaterName && <p className="theater-name">{theaterName}</p>}
        </div>
      </div>

      <div className="order-history-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!error && orders.length === 0 && (
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <h3>No Orders Yet</h3>
            <p>Your order history will appear here</p>
          </div>
        )}

        {!error && orders.length > 0 && (
          <div className="orders-list">
            {orders.map((order, index) => (
              <div key={index} className="order-card">
                <div className="order-header">
                  <div className="order-number">
                    <span className="label">Order</span>
                    <span className="value">#{order.orderNumber}</span>
                  </div>
                  <div 
                    className="order-status"
                    style={{ color: getStatusColor(order.status) }}
                  >
                    {getStatusText(order.status)}
                  </div>
                </div>

                <div className="order-date">
                  {formatDate(order.createdAt)}
                </div>

                <div className="order-items">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      <span className="item-name">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="item-price">
                        {formatPrice(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="order-footer">
                  <div className="payment-method">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    <span>{order.payment?.method || 'Cash'}</span>
                  </div>
                  <div className="order-total">
                    <span className="total-label">Total:</span>
                    <span className="total-amount">{formatPrice(order.pricing?.total)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerOrderHistory;