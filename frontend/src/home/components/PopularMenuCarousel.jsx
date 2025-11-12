import React, { useEffect, useRef } from 'react';
import '../../styles/home/PopularMenuCarousel.css';
import popcornImg from '../images/Popcorn.jpg';
import pizzaImg from '../images/pizza.jpg';
import iceCreamImg from '../images/ice cream.jpg';
import burgerImg from '../images/Burger.jpg';
import cooldrinksImg from '../images/cooldrinks.png';
import iceBallImg from '../images/Ice Ball.png';

const PopularMenuCarousel = () => {
  const imageRef = useRef(null);
  const contentsRef = useRef([]);
  const rotateRef = useRef(0);
  const activeRef = useRef(0);

  const menuItems = [
    {
      id: 1,
      title: "Gourmet Popcorn",
      description: "Freshly popped, perfectly seasoned popcorn in multiple flavors. A classic theater favorite that's always made fresh to order.",
      image: popcornImg
    },
    {
      id: 2,
      title: "Delicious Pizza",
      description: "Hot and fresh pizza slices with various toppings. Delivered right to your seat while you enjoy the show.",
      image: pizzaImg
    },
    {
      id: 3,
      title: "Premium Ice Cream",
      description: "Creamy and refreshing ice cream in multiple flavors. Perfect for a sweet treat during your movie experience.",
      image: iceCreamImg
    },
    {
      id: 4,
      title: "Tasty Burgers",
      description: "Delicious gourmet burgers made with quality ingredients. A hearty and satisfying option for movie time.",
      image: burgerImg
    },
    {
      id: 5,
      title: "Refreshing Cool Drinks",
      description: "Ice-cold beverages and refreshing soft drinks to quench your thirst. Perfect companion for your movie experience.",
      image: cooldrinksImg
    },
    {
      id: 6,
      title: "Ice Ball Treats",
      description: "Colorful and flavorful ice balls that are fun and refreshing. A unique frozen treat that's perfect for all ages.",
      image: iceBallImg
    }
  ];

  const countItem = menuItems.length;
  const rotateAdd = 360 / countItem;

  useEffect(() => {
    const nextSlider = () => {
      activeRef.current = activeRef.current + 1 > countItem - 1 ? 0 : activeRef.current + 1;
      rotateRef.current = rotateRef.current + rotateAdd;
      show();
    };

    const show = () => {
      if (imageRef.current) {
        imageRef.current.style.setProperty("--rotate", rotateRef.current + 'deg');
      }
      contentsRef.current.forEach((content, key) => {
        if (content) {
          if (key === activeRef.current) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        }
      });
    };

    // Auto-rotate every 5 seconds (slower speed)
    const autoNext = setInterval(nextSlider, 5000);

    return () => {
      clearInterval(autoNext);
    };
  }, [countItem, rotateAdd]);

  return (
    <section className="popular-menu-section section-padding">
      <div className="menu-slider">
        <div className="menu-title">
          Popular Theater Menu Items
        </div>
        <div className="menu-images" ref={imageRef}>
          {menuItems.map((item, index) => (
            <div className="menu-image-item" style={{ '--i': index + 1 }} key={item.id}>
              <img src={item.image} alt={item.title} />
            </div>
          ))}
        </div>
        <div className="menu-content">
          {menuItems.map((item, index) => (
            <div 
              className={`menu-content-item ${index === 0 ? 'active' : ''}`} 
              key={item.id}
              ref={(el) => (contentsRef.current[index] = el)}
            >
              <h3>{item.title}</h3>
              <div className="menu-description">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PopularMenuCarousel;
