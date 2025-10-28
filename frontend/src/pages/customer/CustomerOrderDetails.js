import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import config from '../../config';
import './../../styles/customer/CustomerOrderDetails.css';

const CustomerOrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(location.search);
      const theaterId = params.get('theaterid');
      const phoneNumber = params.get('phone');

      if (!theaterId || !phoneNumber) {
        throw new Error('Missing required parameters');
      }

      const response = await fetch(`${config.api.baseUrl}/orders/theater/${theaterId}`);
      if (!response.ok) throw new Error('Failed to fetch orders');

      const data = await response.json();
      
      // Find the specific order by orderId and phone number
      const foundOrder = data.orders.find(order => 
        order._id === orderId && 
        order.customerInfo?.phone === phoneNumber
      );

      console.log('📦 Found Order:', foundOrder);
      console.log('💰 Order Totals:', {
        subtotal: foundOrder?.subtotal,
        tax: foundOrder?.tax,
        total: foundOrder?.total,
        totalDiscount: foundOrder?.totalDiscount
      });
      console.log('🛒 Order Items:', foundOrder?.items);

      if (!foundOrder) throw new Error('Order not found');
      setOrder(foundOrder);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => navigate(-1);

  if (loading) {
    return (
      <div className="cart-page">
        <div className="cart-header">
          <button className="back-button" onClick={handleBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="cart-title">Order Details</h1>
          <div className="cart-header-spacer"></div>
        </div>
        <div className="loading-container"><div className="loading-spinner"></div></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="cart-page">
        <div className="cart-header">
          <button className="back-button" onClick={handleBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="cart-title">Order Details</h1>
          <div className="cart-header-spacer"></div>
        </div>
        <div className="empty-cart">
          <div className="empty-cart-icon">⚠️</div>
          <h2 className="empty-cart-title">Error Loading Order</h2>
          <p className="empty-cart-text">{error || 'Order not found'}</p>
        </div>
      </div>
    );
  }

  const items = order.items || [];
  const subtotal = parseFloat(order.subtotal || 0);
  const tax = parseFloat(order.tax || 0);
  const total = parseFloat(order.total || 0);
  const totalDiscount = parseFloat(order.totalDiscount || 0);

  return (
    <div className="cart-page">
      {/* Header */}
      <div className="cart-header">
        <button className="back-button" onClick={handleBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="cart-title">Order Details</h1>
        <div className="cart-header-spacer"></div>
      </div>

      {/* Theater & QR Info */}
      {(order.qrName || order.seat) && (
        <div className="cart-info-section">
          {order.qrName && (
            <div className="cart-info-item">
              <span className="info-icon">📱</span>
              <span className="info-text">{order.qrName}</span>
            </div>
          )}
          {order.seat && (
            <div className="cart-info-item">
              <span className="info-icon">💺</span>
              <span className="info-text">Seat {order.seat}</span>
            </div>
          )}
        </div>
      )}

      {/* Cart Items */}
      <div className="cart-items-container">
        <div className="cart-items-header">
          <h2 className="items-count">{items.length} {items.length === 1 ? 'Item' : 'Items'}</h2>
        </div>

        <div className="cart-items-list">
          {items.map((item, index) => {
            const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
            const discountPercentage = parseFloat(item.discountPercentage) || 0;
            const discountedPrice = discountPercentage > 0 
              ? itemPrice * (1 - discountPercentage / 100)
              : itemPrice;
            const hasDiscount = discountPercentage > 0;
            
            return (
            <div key={item._id || index} className="cart-item">
              <div className="cart-item-image-container">
                <img 
                  src={item.image || '/placeholder-product.png'} 
                  alt={item.name}
                  className="cart-item-image"
                  onError={(e) => {
                    e.target.src = '/placeholder-product.png';
                  }}
                />
                {hasDiscount && (
                  <div className="discount-badge">{discountPercentage}% OFF</div>
                )}
              </div>
              
              <div className="cart-item-details">
                <h3 className="cart-item-name">{item.name}</h3>
                <div className="cart-item-price-container">
                  {hasDiscount ? (
                    <>
                      <p className="cart-item-price">₹{discountedPrice.toFixed(2)}</p>
                      <p className="cart-item-original-price">₹{itemPrice.toFixed(2)}</p>
                    </>
                  ) : (
                    <p className="cart-item-price">₹{itemPrice.toFixed(2)}</p>
                  )}
                </div>
              </div>

              <div className="cart-item-actions">
                <div className="quantity-display-readonly">
                  <span className="quantity-text">Qty: {item.quantity}</span>
                </div>
                <p className="cart-item-total">₹{(discountedPrice * item.quantity).toFixed(2)}</p>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Summary Section */}
      <div className="cart-summary">
        <div className="summary-divider"></div>
        
        <div className="summary-row">
          <span className="summary-label">Subtotal</span>
          <span className="summary-value">₹{subtotal.toFixed(2)}</span>
        </div>
        
        <div className="summary-row">
          <span className="summary-label">Tax (GST)</span>
          <span className="summary-value">₹{tax.toFixed(2)}</span>
        </div>
        
        {totalDiscount > 0 && (
          <div className="summary-row discount-row">
            <span className="summary-label">Discount</span>
            <span className="summary-value discount-value">-₹{totalDiscount.toFixed(2)}</span>
          </div>
        )}
        
        <div className="summary-divider"></div>
        
        <div className="summary-row summary-total">
          <span className="summary-label">Total</span>
          <span className="summary-value">₹{total.toFixed(2)}</span>
        </div>

        {/* Order Info */}
        <div className="order-info-footer">
          <div className="order-info-row">
            <span className="order-info-label">Order ID:</span>
            <span className="order-info-value">{order.orderNumber || orderId}</span>
          </div>
          <div className="order-info-row">
            <span className="order-info-label">Status:</span>
            <span className="order-info-value">{order.status || 'Pending'}</span>
          </div>
          <div className="order-info-row">
            <span className="order-info-label">Payment:</span>
            <span className="order-info-value">{order.paymentMethod || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderDetails;
