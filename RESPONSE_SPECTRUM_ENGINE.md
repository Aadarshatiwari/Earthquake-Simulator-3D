# Response spectrum engine

The scalar solver solves u'' + 2ζωu' + ω²u = −ag using average-acceleration Newmark with β=¼ and γ=½. It adds piecewise-linear substeps to achieve at least 24 integration steps per cycle. Sd and true relative velocity are the peaks of |u| and |u'|. True absolute acceleration is the peak of |u''+ag|. PSV=ωSd and PSA=ω²Sd. The default range is 0.05–10 s, subject to input sampling. Five default damping ratios and custom values are supported. The independent undamped unit step gives Sd=2/ω², relative velocity=1/ω and absolute acceleration=2 m/s².
