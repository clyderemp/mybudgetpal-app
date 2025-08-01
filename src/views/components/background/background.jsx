import { useMemo } from "react";

const NUM_BLOBS = 12;
const generateBlobs = () => {
  const blobs = [];

  for (let i = 0; i < NUM_BLOBS; i++) {
    const topFinal = 10 + Math.random() * 70; // 10% to 80%
    const left = (i / NUM_BLOBS) * 90 + 3; // spread horizontally
    const delay = (Math.random() * 1.5).toFixed(2);

    const bounceX = (-150 + i * 25 + Math.random() * 50).toFixed(1);
    const bounceY = (10 - Math.random() * 200).toFixed(1);

    const floatDriftX = (20 + Math.random() * 60).toFixed(1); // bigger float drift X
    const floatDriftY = (10 + Math.random() * 40).toFixed(1); // bigger float drift Y
    const floatScale = (1 + Math.random() * 0.25).toFixed(2); // bigger scale variation

    blobs.push({
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

  return blobs;
};

const BackgroundBlobs = () => {
  const blobs = useMemo(() => generateBlobs(12), []);

  return (
    <div className="floating-blobs">
      {blobs.map((blob, i) => (
        <div
          key={i}
          className="blob-wrapper"
          style={{
            top: `${blob.topFinal}%`,
            left: `${blob.left}%`,
            "--bounce-x": `${blob.bounceX}px`,
            "--bounce-y": `${blob.bounceY}px`,
            "--float-drift-x": `${blob.floatDriftX}px`,
            "--float-drift-y": `${blob.floatDriftY}px`,
            "--float-scale": blob.floatScale,
            "--delay": `${blob.delay}s`,
          }}
        >
          <div className="float-inner">
            <div className="blob red" />
            <div className="blob blue" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default BackgroundBlobs;
