# Rendering readiness

The Phase 7 shared viewport only subscribed to a first-draw notification on Home. Canvas mount and React Suspense completion did not establish whether the constructor had drawn a frame. The updated shared viewport exposes its readiness through a DOM attribute after Three.js records a positive triangle count on a nonzero drawing buffer. It displays an explicit loading state and a keyed retry if the draw fails to arrive. The constructor and simulator keep their existing error boundaries and context-loss recovery.

The original blank capture is historical evidence. Its exact trigger could not be reproduced reliably. Home, constructor and simulator were observed ready in the live preview. Protection and legacy scenes use separate rendering paths and have not received the same instrumentation.
