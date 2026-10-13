import { cssInterop } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

// NativeWind v4 className'i yalnızca React Native'in temel bileşenlerinde tanır; ekranlarda className alan
// diğer bileşenler burada style'a bağlanır.
cssInterop(LinearGradient, { className: 'style' });
cssInterop(SafeAreaView, { className: 'style' });
