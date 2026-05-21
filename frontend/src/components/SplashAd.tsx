import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Dimensions } from 'react-native';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

interface SplashAdProps {
  onFinish: () => void;
}

export default function SplashAd({ onFinish }: SplashAdProps) {
  const [timeLeft, setTimeLeft] = useState(3);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Progress bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    // Countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-finish after 3.5s (to allow for final fade or transition)
    const timeout = setTimeout(() => {
      onFinish();
    }, 3500);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.adHeader}>
        <Text style={styles.adLabel}>GOOGLE ADS</Text>
        <View style={styles.skipBadge}>
          <Text style={styles.skipText}>L'app si avvierà tra {timeLeft}s</Text>
        </View>
      </View>
      <View style={styles.adContent}>
        {/* Placeholder per l'immagine dell'annuncio */}
        <View style={styles.imagePlaceholder}>
           <Image 
             source={{ uri: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop' }} 
             style={styles.adImage}
             resizeMode="cover"
           />
           <View style={styles.overlay}>
              <Text style={styles.brandName}>Google Cloud</Text>
              <Text style={styles.tagline}>The future of navigation is here.</Text>
           </View>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.progressBarBg}>
           <Animated.View 
             style={[
               styles.progressBarFill, 
               { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
             ]} 
           />
        </View>
        <Text style={styles.appTitle}>VYRO NAVIGATION</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  adLabel: {
    color: '#AAA',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  skipBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  adContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  imagePlaceholder: {
    width: width - 40,
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    elevation: 10,
    boxShadow: "0px 10px 20px rgba(0,0,0,0.5)",
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  brandName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  tagline: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 2,
  },
  appTitle: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
    opacity: 0.8,
  },
});
