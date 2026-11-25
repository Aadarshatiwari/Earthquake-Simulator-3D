# Fourier analysis

The radix-2 FFT uses optional mean removal and rectangular, periodic Hann or periodic Hamming weights. Amplitude divides by the sum of window weights. PSD multiplies squared magnitude by Δt and divides by squared-weight sum. Both double only interior one-sided bins. The STFT positions successive windowed PSD frames at their centres and displays logarithmic power. Padding refines bin spacing and cannot recover resolution absent from the record. A 4 Hz sinusoid test independently recovers amplitude 3 m/s² and mean square 4.5 (m/s²)².
