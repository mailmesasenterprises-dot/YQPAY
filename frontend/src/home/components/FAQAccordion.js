import React, { useState } from 'react';
import '../../styles/home/FAQAccordion.css';

const FAQAccordion = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const faqData = [
    {
      id: 1,
      category: 'Getting Started',
      question: 'How do customers place orders using QR codes?',
      answer: 'Customers simply scan the QR code at their seat using their smartphone camera. This opens our digital menu where they can browse items, customize orders, and pay securely - all without downloading any app.',
      highlight: 'No App Required'
    },
    {
      id: 2,
      category: 'Compatibility',
      question: 'Is the system compatible with all smartphones?',
      answer: 'Yes! Our system works on any smartphone with a camera and internet connection. It\'s web-based, so customers don\'t need to download any apps. It works seamlessly on iOS, Android, and other mobile devices.',
      highlight: 'Universal Support'
    },
    {
      id: 3,
      category: 'Payments',
      question: 'How do we handle payment processing?',
      answer: 'We integrate with secure payment gateways like Razorpay, supporting credit cards, debit cards, UPI, digital wallets, and net banking. All transactions are encrypted and PCI DSS compliant for maximum security.',
      highlight: 'Bank-Level Security'
    },
    {
      id: 4,
      category: 'Customization',
      question: 'Can we customize the menu and pricing?',
      answer: 'Absolutely! You have complete control over your menu, pricing, categories, and item descriptions. Updates are instant and reflect immediately on all QR codes. You can also set different menus for different time periods.',
      highlight: 'Real-Time Updates'
    },
    {
      id: 5,
      category: 'Analytics',
      question: 'What kind of analytics and reports do we get?',
      answer: 'Our dashboard provides comprehensive analytics including sales reports, popular items, peak hours, customer preferences, revenue trends, and seat-wise ordering patterns. All data is available in real-time and exportable.',
      highlight: 'Advanced Insights'
    },
    {
      id: 6,
      category: 'Setup',
      question: 'How quickly can we get started?',
      answer: 'Setup is incredibly fast! After signing up, you can have your digital menu ready and QR codes generated within 24 hours. We provide full onboarding support and training for your staff.',
      highlight: '24 Hour Setup'
    }
  ];

  const handleFAQClick = (index) => {
    setActiveIndex(index);
  };

  return (
    <section className="faq-unique-section">
      <div className="container">
        {/* Section Title */}
        <div className="faq-title-wrapper">
          <div className="faq-label">Support</div>
          <h2 className="faq-section-title">Frequently Asked Questions</h2>
          <div className="faq-title-underline"></div>
        </div>

        {/* Split Layout: List + Content */}
        <div className="faq-split-container">
          {/* Left Side - Interactive List */}
          <div className="faq-list-side">
            <div className="faq-list">
              {faqData.map((faq, index) => (
                <div
                  key={faq.id}
                  className={`faq-list-item ${activeIndex === index ? 'active' : ''}`}
                  onClick={() => handleFAQClick(index)}
                >
                  <div className="faq-item-header">
                    <span className="faq-category-tag">{faq.category}</span>
                    <div className="faq-expand-indicator">
                      {activeIndex === index ? '−' : '+'}
                    </div>
                  </div>
                  <h4 className="faq-list-question">{faq.question}</h4>
                  <div className="faq-item-bar"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Answer Display */}
          <div className="faq-content-side">
            <div className="faq-content-card">
              <div className="faq-content-header">
                <span className="faq-content-category">
                  {faqData[activeIndex].category}
                </span>
                <span className="faq-content-highlight">
                  {faqData[activeIndex].highlight}
                </span>
              </div>
              
              <h3 className="faq-content-question">
                {faqData[activeIndex].question}
              </h3>
              
              <div className="faq-divider"></div>
              
              <p className="faq-content-answer">
                {faqData[activeIndex].answer}
              </p>

              <div className="faq-content-footer">
                {/* <button className="faq-learn-more">
                  Learn More
                  <span className="arrow-icon">→</span>
                </button> */}
                <div className="faq-counter">
                  <span className="counter-current">0{activeIndex + 1}</span>
                  <span className="counter-divider">/</span>
                  <span className="counter-total">06</span>
                </div>
              </div>
            </div>

            {/* Navigation Arrows */}
            <div className="faq-navigation">
              <button
                className="faq-nav-btn prev"
                onClick={() => setActiveIndex(activeIndex > 0 ? activeIndex - 1 : faqData.length - 1)}
                disabled={activeIndex === 0}
              >
                <span>←</span>
              </button>
              <button
                className="faq-nav-btn next"
                onClick={() => setActiveIndex(activeIndex < faqData.length - 1 ? activeIndex + 1 : 0)}
                disabled={activeIndex === faqData.length - 1}
              >
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Info Bar */}
        <div className="faq-bottom-bar">
          <div className="faq-info-item">
            <div className="info-icon">💬</div>
            <div className="info-text">
              <strong>Live Chat</strong>
              <span>Available 24/7</span>
            </div>
          </div>
          <div className="faq-info-item">
            <div className="info-icon">📧</div>
            <div className="info-text">
              <strong>Email Support</strong>
              <span>Response in 2 hours</span>
            </div>
          </div>
          <div className="faq-info-item">
            <div className="info-icon">📞</div>
            <div className="info-text">
              <strong>Phone Support</strong>
              <span>Mon-Fri, 9AM-6PM</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQAccordion;
