import React, { useState, useEffect } from 'react';
import './LoginHowItWorksSlider.css';

// Import first 5 images from How It Works
import scanQRImage from '../home/images/Scan QR Code.jpg';
import browseMenuImage from '../home/images/Browse Menu.jpg';
import securePaymentImage from '../home/images/Payment.jpg';
import orderProcessingImage from '../home/images/Order Processing.jpg';
import seatDeliveryImage from '../home/images/Seat Delivery.webp';

const LoginHowItWorksSlider = () => {
  const [activeStep, setActiveStep] = useState(0);

  // Only first 5 images (excluding Analytics & Reports)
  const images = [
    { id: 1, src: scanQRImage, alt: "Scan QR Code" },
    { id: 2, src: browseMenuImage, alt: "Browse Menu" },
    { id: 3, src: securePaymentImage, alt: "Secure Payment" },
    { id: 4, src: orderProcessingImage, alt: "Order Processing" },
    { id: 5, src: seatDeliveryImage, alt: "Seat Delivery" }
  ];

  // Auto-scroll every 3 seconds
  useEffect(() => {
    const autoPlay = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(autoPlay);
  }, [images.length]);

  return (
    <div className="login-how-it-works-slider">
      {/* Images Container */}
      <div className="login-slider-images">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`login-slider-image ${activeStep === index ? 'active' : ''}`}
          >
            <img src={image.src} alt={image.alt} />
          </div>
        ))}
      </div>

      {/* Dots Indicator */}
      <div className="login-slider-dots">
        {images.map((_, index) => (
          <div
            key={index}
            className={`login-slider-dot ${activeStep === index ? 'active' : ''}`}
            onClick={() => setActiveStep(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default LoginHowItWorksSlider;
