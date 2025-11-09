import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay, EffectFade } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import '../styles/HowItWorksSlider.css';

// Import images
import scanQRImage from '../Images/Scan QR Code.jpg';
import browseMenuImage from '../Images/Browse Menu.jpg';

const HowItWorksSlider = () => {
  const slides = [
    {
      id: 1,
    //   category: "STEP ONE",
      title: "Scan QR Code",
      description: "Audience members scan a unique QR code placed on their theater seat using their smartphone for instant access.",
      image: scanQRImage,
      bgGradient: "linear-gradient(135deg, #E8D5FF 0%, #F5E6FF 100%)"
    },
    {
      id: 2,
    //   category: "STEP TWO",
      title: "Browse Menu",
      description: "Access a full digital menu with detailed descriptions, images, and prices. Add items to the cart with just a few taps.",
      image: browseMenuImage,
      bgGradient: "linear-gradient(135deg, #E8D5FF 0%, #F5E6FF 100%)"
    },
    {
      id: 3,
    //   category: "STEP THREE",
      title: "Secure Payment",
      description: "Pay safely through integrated payment gateways like Razorpay, with multiple secure payment options available.",
      image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      bgGradient: "linear-gradient(135deg, #E8D5FF 0%, #F5E6FF 100%)"
    },
    {
      id: 4,
    //   category: "STEP FOUR",
      title: "Order Processing",
      description: "Orders are instantly sent to the kitchen with seat details. Real-time updates keep customers informed on progress.",
      image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      bgGradient: "linear-gradient(135deg, #E8D5FF 0%, #F5E6FF 100%)"
    },
    {
      id: 5,
    //   category: "STEP FIVE",
      title: "Seat Delivery",
      description: "Snacks and beverages are delivered directly to the customer's seat, ensuring uninterrupted enjoyment of the show.",
      image: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      bgGradient: "linear-gradient(135deg, #E8D5FF 0%, #F5E6FF 100%)"
    },
    {
      id: 6,
    //   category: "STEP SIX",
      title: "Analytics & Reports",
      description: "Theater management receives detailed sales reports, order analytics, and performance insights to optimize operations.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      bgGradient: "linear-gradient(135deg, #E8D5FF 0%, #F5E6FF 100%)"
    }
  ];

  return (
    <section id="how-it-works" className="modern-slider-section">
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={0}
        slidesPerView={1}
        navigation={{
          nextEl: '.swiper-button-next-custom',
          prevEl: '.swiper-button-prev-custom',
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        autoplay={{
          delay: 2000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        speed={1000}
        loop={true}
        className="modern-swiper"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            <div 
              className="slide-container"
              style={{ background: slide.bgGradient }}
            >
              <div className="slide-content">
                {/* Left Side - Text Content */}
                <div className="slide-text">
                  <div className="slide-category">{slide.category}</div>
                  <h2 className="slide-title">{slide.title}</h2>
                  <p className="slide-description">{slide.description}</p>
                  {/* <a href="#contact" className="slide-cta">
                    See more
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </a> */}
                </div>

                {/* Right Side - Product Display */}
                <div className="slide-visual">
                  {/* Main Product - Sharp and Focused */}
                  <div className="product-main">
                    <img 
                      src={slide.image} 
                      alt={slide.title}
                      className="product-image-main"
                    />
                    <div className="product-shadow"></div>
                  </div>

                  {/* Background Products - Blurred */}
                  <div className="product-bg product-bg-1">
                    <img 
                      src={slide.image} 
                      alt=""
                      className="product-image-bg"
                    />
                  </div>
                  <div className="product-bg product-bg-2">
                    <img 
                      src={slide.image} 
                      alt=""
                      className="product-image-bg"
                    />
                  </div>
                  <div className="product-bg product-bg-3">
                    <img 
                      src={slide.image} 
                      alt=""
                      className="product-image-bg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}

        {/* Custom Navigation Buttons */}
        <div className="swiper-button-prev-custom">
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
        <div className="swiper-button-next-custom">
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </Swiper>
    </section>
  );
};

export default HowItWorksSlider;
