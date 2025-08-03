import React, { useMemo } from "react";

const NUM_COINS = 12;

const generateCoins = () => {
  const coins = [];

  for (let i = 0; i < NUM_COINS; i++) {
    const topFinal = 10 + Math.random() * 70; // 10% to 80%
    const left = (i / NUM_COINS) * 90 + 3; // spread horizontally
    const delay = (Math.random() * 1.5).toFixed(2);

    // Bounce offsets after landing (to simulate bounce scatter)
    const bounceX = (-150 + i * 25 + Math.random() * 50).toFixed(1);
    const bounceY = (10 - Math.random() * 200).toFixed(1);

    // Float drift offsets (slow, gentle floating)
    const floatDriftX = (20 + Math.random() * 60).toFixed(1);
    const floatDriftY = (10 + Math.random() * 40).toFixed(1);

    // Slight scale variation
    const floatScale = (1 + Math.random() * 0.25).toFixed(2);

    coins.push({
      topFinal,
      left,
      delay,
      bounceX,
      bounceY,
      floatDriftX,
      floatDriftY,
      floatScale,
    });
  }

  return coins;
};

const CoinsBackground = () => {
  const coins = useMemo(() => generateCoins(), []);

  return (
    <div className="floating-coins">
      {coins.map((coin, i) => (
        <div
          key={i}
          className="coin-wrapper"
          style={{
            top: `${coin.topFinal}%`,
            left: `${coin.left}%`,
            "--bounce-x": `${coin.bounceX}px`,
            "--bounce-y": `${coin.bounceY}px`,
            "--float-drift-x": `${coin.floatDriftX}px`,
            "--float-drift-y": `${coin.floatDriftY}px`,
            "--float-scale": coin.floatScale,
            "--delay": `${coin.delay}s`,
          }}
        >
          <div className="float-inner">
            <div className="coin">$</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CoinsBackground;
