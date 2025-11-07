import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LazyImage from '../../components/LazyImage';
import HowItWorksSlider from '../components/HowItWorksSliderNew';
import PopularMenuCarousel from '../components/PopularMenuCarousel';
// import FAQAccordion from '../components/FAQAccordion';
import config from '../../config';
import '../../styles/home/HomePage.css';
import '../../styles/home/HeroNew.css';
import '../../styles/home/Responsive.css';
import { useCursor } from '../../hooks/useCursor';
import heroVideo from '../images/Home-1.mp4';  // ✅ Import the video (correct filename)
import scanQRVideo from '../images/Home-1.mp4';  // Video for Scan QR Code step
import browseMenuImage from '../images/Browse Menu.jpg';  // Image for Browse Menu step
import scanQRImage from '../images/Scan QR Code.jpg';  // Image for Scan QR Code step

const HomePage = () => {
  // Add custom cursor effect
  useCursor();
  
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  useEffect(() => {
    // Close mobile menu when clicking outside
    const handleClickOutside = (e) => {
      if (isMobileMenuOpen && !e.target.closest('.navbar')) {
        setIsMobileMenuOpen(false);
      }
    };
    
    // Prevent body scroll when menu is open
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    // Add scroll animations
    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1,
    });

    // Observe all animatable elements
    document.querySelectorAll('.fade-up, .fade-in, .slide-in-left, .slide-in-right').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);
  return (
    <div className="home-page frontend-page">
      {/* Header */}
      <header className="header">
        <div className="container">
          <nav className="navbar">
            <div className="logo">
              <div className="logo-content">
               
                <h2>{config.branding.companyName}</h2>
              </div>
            </div>
            
            {/* Hamburger Menu Button - Mobile Only */}
            <button 
              className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>

            {/* Navigation Links */}
            <div 
              id="mobile-navigation"
              className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}
              role="navigation"
              aria-label="Main navigation"
            >
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
              <a href="#benefits" onClick={() => setIsMobileMenuOpen(false)}>Benefits</a>
              <Link to="/login" className="btn-primary" onClick={() => setIsMobileMenuOpen(false)}>Admin Login</Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section - New Modern Design */}
      <section className="hero-new">
        <div className="hero-diagonal-bg"></div>
        <div className="hero-particles">
          <div className="particle particle-1"></div>
          <div className="particle particle-2"></div>
          <div className="particle particle-3"></div>
          <div className="particle particle-4"></div>
          <div className="particle particle-5"></div>
        </div>
        <div className="container">
          <div className="hero-new-content">
            <div className="hero-left fade-up">
              <div className="hero-badge">
                <span className="badge-icon">⚡</span>
                <span>Next-Gen QR Ordering</span>
              </div>
              <h1 className="hero-new-title">
                Transform Your Theater Experience with
                <span className="hero-highlight"> Smart QR Ordering</span>
              </h1>
            </div>
            <div className="hero-right slide-in-right">
              <div className="hero-visual">
                <div className="visual-circle visual-circle-1"></div>
                <div className="visual-circle visual-circle-2"></div>
                <div className="visual-circle visual-circle-3"></div>
                <div className="hero-image-main">
                  <video 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    className="hero-main-video"
                  >
                    <source src={heroVideo} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="floating-card floating-card-1">
                  <div className="card-icon">📱</div>
                  <div className="card-content">
                    <div className="card-title">Scan QR</div>
                    <div className="card-desc">Instant Access</div>
                  </div>
                </div>
                <div className="floating-card floating-card-2">
                  <div className="card-icon">🎯</div>
                  <div className="card-content">
                    <div className="card-title">Order</div>
                    <div className="card-desc">Quick & Easy</div>
                  </div>
                </div>
                <div className="floating-card floating-card-3">
                  <div className="card-icon">✓</div>
                  <div className="card-content">
                    <div className="card-title">Delivered</div>
                    <div className="card-desc">To Your Seat</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hero-bottom fade-up">
              <p className="hero-new-subtitle">
                Eliminate queues, boost revenue, and delight your audience with seamless seat-side ordering. The future of theater canteen management is here.
              </p>
              <div className="hero-stats">
                <div className="stat-item fade-up" style={{ animationDelay: '0.2s' }}>
                  <div className="stat-number">80%</div>
                  <div className="stat-label">Queue Reduction</div>
                </div>
                <div className="stat-item fade-up" style={{ animationDelay: '0.3s' }}>
                  <div className="stat-number">35%</div>
                  <div className="stat-label">Revenue Increase</div>
                </div>
                <div className="stat-item fade-up" style={{ animationDelay: '0.4s' }}>
                  <div className="stat-number">500+</div>
                  <div className="stat-label">Happy Theaters</div>
                </div>
              </div>
              <div className="hero-new-buttons fade-up" style={{ animationDelay: '0.5s' }}>
                <Link to="/login" className="btn-new-primary">
                  <span>Start Free Trial</span>
                  <svg className="btn-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10H16M16 10L10 4M16 10L10 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <a href="#how-it-works" className="btn-new-secondary">
                  <svg className="btn-play" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M6.5 4.5L15.5 10L6.5 15.5V4.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>See How It Works</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      
      <HowItWorksSlider />

      {/* Features Section */}
      {/* <section id="features" className="features section-padding">
        <div className="container">
          <div className="section-header">
            <h2 className="heading-lg">Powerful Features</h2>
            <p className="text-lg">Everything you need to manage your theater canteen efficiently</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card card">
              <div className="feature-icon">
                <LazyImage src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="QR Code Management for theaters" />
              </div>
              <h3 className="heading-md">QR Code Management</h3>
              <p>Generate unique QR codes for each seat and screen. Easy management and regeneration options.</p>
            </div>

            <div className="feature-card card">
              <div className="feature-icon">
                <LazyImage src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Theater sales analytics dashboard" />
              </div>
              <h3 className="heading-md">Real-time Analytics</h3>
              <p>Comprehensive dashboard with sales reports, order analytics, and performance insights.</p>
            </div>

            <div className="feature-card card">
              <div className="feature-icon">
                <LazyImage src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Multi-theater admin management system" />
              </div>
              <h3 className="heading-md">Multi-Admin System</h3>
              <p>Super Admin controls multiple theaters with individual Theater Admin management.</p>
            </div>

            <div className="feature-card card">
              <div className="feature-icon">
                <LazyImage src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Secure payment gateway integration" />
              </div>
              <h3 className="heading-md">Secure Payments</h3>
              <p>Integrated payment gateways with multiple payment options and secure transactions.</p>
            </div>

            <div className="feature-card card">
              <div className="feature-icon">
                <LazyImage src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Mobile responsive theater ordering" />
              </div>
              <h3 className="heading-md">Mobile Responsive</h3>
              <p>Fully responsive design that works perfectly on all devices and screen sizes.</p>
            </div>

            <div className="feature-card card">
              <div className="feature-icon">
                <LazyImage src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" alt="Smart notifications for theater orders" />
              </div>
              <h3 className="heading-md">Smart Notifications</h3>
              <p>Firebase push notifications and SMS alerts for order updates and important events.</p>
            </div>
          </div>
        </div>
      </section> */}

      {/* FAQ Section - New Accordion Design */}
      {/* <FAQAccordion /> */}


      {/* Popular Theater Menu Items - New Circular Carousel Design */}
      <PopularMenuCarousel />

      {/* Benefits Section - Compact Premium Design */}
      <section id="benefits" className="benefits-premium">
        <div className="benefits-bg-gradient"></div>
        
        <div className="container">
          {/* Header */}
          <div className="benefits-header-compact fade-up">
            <span className="benefits-badge">⚡ Benefits</span>
            <h2 className="benefits-h2">Why Choose Our <span className="text-gradient">QR Ordering System?</span></h2>
          </div>

          {/* Benefits List - Compact */}
          <div className="benefits-compact-list">
            <div className="benefit-compact-item fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="benefit-icon-circle">⚡</div>
              <div className="benefit-text">
                <h3>Reduce Queue Times</h3>
                <p>Eliminate long queues and reduce wait times by 80%</p>
              </div>
              <div className="benefit-stat-badge">80%</div>
            </div>

            <div className="benefit-compact-item fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="benefit-icon-circle">📈</div>
              <div className="benefit-text">
                <h3>Boost Revenue</h3>
                <p>Increase sales by 35% with seamless ordering</p>
              </div>
              <div className="benefit-stat-badge">+35%</div>
            </div>

            <div className="benefit-compact-item fade-up" style={{ animationDelay: '0.3s' }}>
              <div className="benefit-icon-circle">⭐</div>
              <div className="benefit-text">
                <h3>Better Experience</h3>
                <p>Enhance satisfaction with seat-side delivery</p>
              </div>
              <div className="benefit-stat-badge">95%</div>
            </div>

            <div className="benefit-compact-item fade-up" style={{ animationDelay: '0.4s' }}>
              <div className="benefit-icon-circle">📊</div>
              <div className="benefit-text">
                <h3>Real-Time Analytics</h3>
                <p>Make data-driven decisions with live insights</p>
              </div>
              <div className="benefit-stat-badge">24/7</div>
            </div>
          </div>

          {/* CTA */}
          <div className="benefits-cta-compact fade-up" style={{ animationDelay: '0.5s' }}>
            <Link to="/login" className="cta-btn-compact">
              Start Free Trial
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M4 10H16M16 10L10 4M16 10L10 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta section-padding enhanced-section">
        <div className="container">
          <div className="cta-content fade-up">
            <h2 className="heading-lg section-title">Ready to Transform Your Theater Canteen?</h2>
            <p className="text-lg" style={{ animationDelay: '0.2s' }}>Join hundreds of theaters already using our QR ordering system</p>
            <div className="cta-buttons fade-up" style={{ animationDelay: '0.4s' }}>
              <Link to="/login" className="btn-primary btn-enhanced">
                <span>Start Free Trial</span>
                <div className="btn-shine"></div>
              </Link>
              <a href="#contact" className="btn-secondary btn-enhanced">
                <span>Contact Sales</span>
                <div className="btn-shine"></div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Modern Enhanced Design */}
      <footer className="footer-modern">
        <div className="footer-particles-bg">
          <div className="footer-particle footer-particle-1"></div>
          <div className="footer-particle footer-particle-2"></div>
          <div className="footer-particle footer-particle-3"></div>
        </div>
        
        <div className="container">
          {/* Main Footer Content */}
          <div className="footer-main-content">
            {/* Brand Section */}
            <div className="footer-brand-section fade-up">
              <div className="footer-logo-wrapper">
                <div className="footer-logo-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="8" fill="url(#footer-gradient)"/>
                    <path d="M20 10L28 18L20 26L12 18L20 10Z" fill="white" fillOpacity="0.9"/>
                    <defs>
                      <linearGradient id="footer-gradient" x1="0" y1="0" x2="40" y2="40">
                        <stop offset="0%" stopColor="#5A0C82"/>
                        <stop offset="100%" stopColor="#7C3AED"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h3 className="footer-brand-name">YQPayNow</h3>
              </div>
              <p className="footer-brand-description">
                Revolutionizing theater canteen experience with smart QR ordering solutions. 
                Empowering theaters to deliver exceptional customer service.
              </p>
              <div className="footer-social-links">
                <a href="#facebook" className="footer-social-link" aria-label="Facebook">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z"/>
                  </svg>
                </a>
                <a href="#twitter" className="footer-social-link" aria-label="Twitter">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84"/>
                  </svg>
                </a>
                <a href="#linkedin" className="footer-social-link" aria-label="LinkedIn">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M18.333 0H1.667C.747 0 0 .746 0 1.667v16.666C0 19.253.746 20 1.667 20h16.666C19.254 20 20 19.254 20 18.333V1.667C20 .747 19.254 0 18.333 0zM6.667 16.667H3.333V7.5h3.334v9.167zM5 6.25a1.944 1.944 0 110-3.889 1.944 1.944 0 010 3.889zm11.667 10.417h-3.334v-4.584c0-1.093-.02-2.5-1.52-2.5-1.521 0-1.754 1.188-1.754 2.417v4.667H6.667V7.5h3.187v1.25h.046c.444-.833 1.527-1.708 3.146-1.708 3.364 0 3.987 2.208 3.987 5.083v4.542h.334z"/>
                  </svg>
                </a>
                <a href="#instagram" className="footer-social-link" aria-label="Instagram">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 0C7.284 0 6.944.012 5.877.06 4.813.109 4.086.278 3.45.525a4.927 4.927 0 00-1.78 1.159A4.927 4.927 0 00.525 3.45C.278 4.086.109 4.813.06 5.877.012 6.944 0 7.284 0 10s.012 3.056.06 4.123c.049 1.064.218 1.791.465 2.427a4.927 4.927 0 001.159 1.78 4.927 4.927 0 001.78 1.159c.636.247 1.363.416 2.427.465C6.944 19.988 7.284 20 10 20s3.056-.012 4.123-.06c1.064-.049 1.791-.218 2.427-.465a4.927 4.927 0 001.78-1.159 4.927 4.927 0 001.159-1.78c.247-.636.416-1.363.465-2.427.048-1.067.06-1.407.06-4.123s-.012-3.056-.06-4.123c-.049-1.064-.218-1.791-.465-2.427a4.927 4.927 0 00-1.159-1.78 4.927 4.927 0 00-1.78-1.159C15.914.278 15.187.109 14.123.06 13.056.012 12.716 0 10 0zm0 1.802c2.67 0 2.987.01 4.041.059.976.045 1.505.207 1.858.344.466.182.8.398 1.15.748.35.35.566.684.748 1.15.137.353.299.882.344 1.858.048 1.054.058 1.37.058 4.039 0 2.67-.01 2.986-.058 4.04-.045.976-.207 1.505-.344 1.858a3.097 3.097 0 01-.748 1.15c-.35.35-.684.566-1.15.748-.353.137-.882.299-1.858.344-1.054.048-1.37.058-4.041.058-2.67 0-2.987-.01-4.04-.058-.976-.045-1.505-.207-1.858-.344a3.097 3.097 0 01-1.15-.748 3.098 3.098 0 01-.748-1.15c-.137-.353-.299-.882-.344-1.858-.048-1.054-.058-1.37-.058-4.04 0-2.67.01-2.986.058-4.04.045-.976.207-1.505.344-1.858.182-.466.398-.8.748-1.15.35-.35.684-.566 1.15-.748.353-.137.882-.299 1.858-.344 1.054-.048 1.37-.058 4.04-.058z"/>
                    <path d="M10 13.333a3.333 3.333 0 110-6.666 3.333 3.333 0 010 6.666zM10 5a5 5 0 100 10 5 5 0 000-10zm6.406-1.845a1.667 1.667 0 11-3.334 0 1.667 1.667 0 013.334 0z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-links-section fade-up" style={{ animationDelay: '0.1s' }}>
              <h4 className="footer-section-title">Features</h4>
              <ul className="footer-links-list">
                <li><a href="#features" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  QR Management
                </a></li>
                <li><a href="#features" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Real-time Analytics
                </a></li>
                <li><a href="#features" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Multi-Admin System
                </a></li>
                <li><a href="#features" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Mobile Responsive
                </a></li>
                <li><a href="#features" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Smart Notifications
                </a></li>
              </ul>
            </div>

            {/* Support Links */}
            <div className="footer-links-section fade-up" style={{ animationDelay: '0.2s' }}>
              <h4 className="footer-section-title">Support</h4>
              <ul className="footer-links-list">
                <li><a href="#help" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Help Center
                </a></li>
                <li><a href="#contact" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Contact Us
                </a></li>
                <li><a href="#docs" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Documentation
                </a></li>
                <li><a href="#api" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  API Reference
                </a></li>
                <li><a href="#faq" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  FAQs
                </a></li>
              </ul>
            </div>

            {/* Company Links */}
            <div className="footer-links-section fade-up" style={{ animationDelay: '0.3s' }}>
              <h4 className="footer-section-title">Company</h4>
              <ul className="footer-links-list">
                <li><a href="#about" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  About Us
                </a></li>
                <li><a href="#careers" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Careers
                </a></li>
                <li><a href="#blog" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Blog
                </a></li>
                <li><a href="#privacy" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Privacy Policy
                </a></li>
                <li><a href="#terms" className="footer-link">
                  <span className="footer-link-icon">→</span>
                  Terms of Service
                </a></li>
              </ul>
            </div>

            {/* Newsletter Section */}
            <div className="footer-newsletter-section fade-up" style={{ animationDelay: '0.4s' }}>
              <h4 className="footer-section-title">Stay Updated</h4>
              <p className="footer-newsletter-description">
                Subscribe to our newsletter for the latest updates and features.
              </p>
              <form className="footer-newsletter-form" onSubmit={(e) => e.preventDefault()}>
                <div className="footer-input-wrapper">
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    className="footer-newsletter-input"
                    required
                  />
                  <button type="submit" className="footer-newsletter-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10H16M16 10L10 4M16 10L10 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </form>
              <div className="footer-trust-badges">
                <div className="footer-trust-badge">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0L10.472 5.528L16 8L10.472 10.472L8 16L5.528 10.472L0 8L5.528 5.528L8 0Z"/>
                  </svg>
                  <span>Trusted by 500+ Theaters</span>
                </div>
                <div className="footer-trust-badge">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0L9.798 6.202L16 8L9.798 9.798L8 16L6.202 9.798L0 8L6.202 6.202L8 0Z"/>
                  </svg>
                  <span>99.9% Uptime</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="footer-bottom-modern">
            <div className="footer-bottom-content">
              <p className="footer-copyright">
                &copy; 2025 <span className="footer-brand-highlight">YQPayNow</span>. All rights reserved. Made with 💜 for theaters worldwide.
              </p>
              <div className="footer-bottom-links">
                <a href="#privacy" className="footer-bottom-link">Privacy</a>
                <span className="footer-divider">•</span>
                <a href="#terms" className="footer-bottom-link">Terms</a>
                <span className="footer-divider">•</span>
                <a href="#cookies" className="footer-bottom-link">Cookies</a>
                <span className="footer-divider">•</span>
                <a href="#sitemap" className="footer-bottom-link">Sitemap</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
