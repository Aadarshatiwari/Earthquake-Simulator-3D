# Visual material library

The constructor supplies eleven named surface finishes: concrete, red brick, stone, steel, timber, glass, plaster, tile, asphalt, soil and gravel. Each material has a base color, roughness and metalness. Original canvas textures provide deterministic surface structure for applicable finishes. Non-glass materials use subtle scalar bump detail. Observable glazing is shaded with a blue-green material and environment reflections. X-ray mode uses translucent architectural surfaces. Materials use box UVs and do not infer an actual physical finish scale for engineering purposes.

Surfaces affect rendering. They have no connection to elastic modulus, floor mass, stiffness, or damping. See [asset licenses](ASSET_LICENSES.md) for provenance.
