import { View, Text, StyleSheet, Platform, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface WebAdProps {
  type: 'footer' | 'sidebar';
}

export default function WebAdBanner({ type }: WebAdProps) {
  // Mostriamo questo componente solo su Web
  if (Platform.OS !== 'web') return null;

  if (type === 'footer') {
    return (
      <View style={styles.footerAd}>
        <View style={styles.adBadge}><Text style={styles.adBadgeText}>AD</Text></View>
        <Text style={styles.adText}>Drive smarter with Google Cloud and VYRO Integration</Text>
        <TouchableOpacity style={styles.learnMore}>
          <Text style={styles.learnMoreText}>LEARN MORE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.sidebarAd}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.adBadgeText}>SPONSORED</Text>
        <Ionicons name="information-circle-outline" size={12} color="#AAA" />
      </View>
      <View style={styles.sidebarContent}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop' }} 
          style={styles.sidebarImg}
          resizeMode="cover"
        />
        <View style={styles.sidebarTextContainer}>
          <Text style={styles.sidebarTitle}>VYRO CLOUD INFRASTRUCTURE</Text>
          <Text style={styles.sidebarDesc}>
            Scale your fleet operations with zero-latency routing and real-time grid telemetry. 
            Built for the future of tactical navigation.
          </Text>
          <TouchableOpacity style={styles.sidebarButton}>
            <Text style={styles.sidebarButtonText}>DISCOVER MORE</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.sidebarFooter}>
        <Text style={styles.footerBrand}>Powered by Google Cloud</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerAd: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    zIndex: 9999,
  },
  adBadgeText: {
    color: '#AAA',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sidebarAd: {
    width: 250,
    height: 600, // Altezza aumentata per equilibrare il login
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarImg: {
    width: '100%',
    height: 250, // Immagine più grande e verticale
  },
  sidebarTextContainer: {
    padding: 16,
    flex: 1,
    justifyContent: 'center',
  },
  sidebarTitle: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sidebarDesc: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  sidebarButton: {
    marginTop: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  sidebarButtonText: {
    color: theme.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  sidebarFooter: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  footerBrand: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  learnMore: {
    marginLeft: 20,
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  learnMoreText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  adText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  adBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 12,
  },
});
