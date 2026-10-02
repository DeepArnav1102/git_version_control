import React, { useRef, useEffect } from 'react';
import { Lottie } from 'lottie-react';
import IconBox from './IconBox';

/**
 * LottieIcon — renders a Lottie animation inside an IconBox.
 *
 * Props:
 *   src       – Lottie JSON source
 *   isToggle  – if true, clicking toggles forward/reverse (default: true)
 *   trigger   – 'click' | 'hover' — what triggers the animation (default: 'click')
 */
const LottieIcon = ({ src, isToggle = true, trigger = 'click', onClick, active }) => {
  const lottieRef = useRef();
  const openRef = useRef(false);

  useEffect(() => {
    if (active !== undefined && active !== openRef.current) {
      if (active) {
        playForward();
        openRef.current = true;
      } else {
        playReverse();
        openRef.current = false;
      }
    }
  }, [active]);

  const playForward = () => {
    const anim = lottieRef.current;
    if (!anim) return;
    anim.setDirection('forward');
    anim.stop();
    anim.play();
  };

  const playReverse = () => {
    const anim = lottieRef.current;
    if (!anim) return;
    anim.setDirection('reverse');
    anim.stop();
    if (anim.animationItem) {
      anim.animationItem.goToAndStop(anim.animationItem.totalFrames - 1, true);
    }
    anim.play();
  };

  const handleClick = () => {
    if (trigger === 'hover') {
      if (onClick) onClick();
      return;
    }

    if (isToggle) {
      if (!openRef.current) {
        playForward();
        openRef.current = true;
        if (onClick) onClick(true);
      } else {
        playReverse();
        openRef.current = false;
        if (onClick) onClick(false);
      }
    } else {
      playForward();
      if (onClick) onClick();
    }
  };

  const handleMouseEnter = () => {
    if (trigger !== 'hover') return;
    playForward();
  };

  const handleMouseLeave = () => {
    if (trigger !== 'hover') return;
    playReverse();
  };

  return (
    <IconBox onClick={handleClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Lottie
        lottieRef={lottieRef}
        src={src}
        loop={false}
        autoplay={false}
        style={{ width: 18, height: 18 }}
      />
    </IconBox>
  );
};

export default LottieIcon;
