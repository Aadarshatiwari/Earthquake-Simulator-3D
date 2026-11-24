# Using the building constructor

1. Open **Build & test** and choose one of the eight presets. Add or remove storeys from Presets, or enter an exact count in Geometry.
2. Use **Geometry** for grid, member, slab, foundation, façade, door bay, windows, roof, balcony and stair controls. Span is uniform within each direction and is derived from the plan width/depth and bay count.
3. Use **Analysis** for individual heights, mass, lateral stiffness, proportional damping targets and optional linear bearing parameters. Choose any mode to preview its computed shape.
4. Use **View** to change environment, distortion scale, undeformed overlay, section axis/offset, floor gap and isolated storey. Click a rendered component for its identifier, dimensions, surface and linked analytical level. Material inspection also offers a keyboard-accessible component list.
5. **Continue to simulation** solves the current model for the included synthetic 0.28 g pulse, then plays the calculated response in the viewport. The summary lists peak roof displacement, model drift and base shear. The environment is illustrative.
6. Use **Save project** and the **Projects** panel to name, reopen, duplicate and delete local projects. JSON export/import supports moving a configuration to another device. Undo and redo cover configuration and project identity changes and are limited to 40 edits.

Project files carry `version: 1`, an identifier, a name and a validated configuration. Imported projects become drafts until explicitly saved. The local library uses browser storage and holds up to 40 projects. Delete requires confirmation. Setup and use require no external model or texture requests.
