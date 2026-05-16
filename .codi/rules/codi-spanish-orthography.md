---
name: codi-spanish-orthography
description: Spanish language orthography enforcement — accents, tildes, punctuation
priority: low
alwaysApply: false
managed_by: codi
version: 1
---

# Spanish Orthography

## Core Rule
When content is in Spanish, ALWAYS write with correct orthography.

## Accents & Diacritics
- Always use accents where required on vowels: á, é, í, ó, ú

BAD: informacion, codigo, funcion, parametro, configuracion, autenticacion
GOOD: información, código, función, parámetro, configuración, autenticación

- Always use tilde on ñ

BAD: ano, diseno, espanol
GOOD: año, diseño, español

- Always use dieresis where required: ü (e.g., bilingüe, pingüino)
- Follow accentuation rules: agudas, llanas, esdrújulas, and sobresdrújulas

## Punctuation
- Use inverted question marks: ¿Pregunta?
- Use inverted exclamation marks: ¡Exclamación!
- Use Latin quotation marks («») when appropriate

## Applies To
- Documentation files
- Code comments
- Commit messages
- Descriptive filenames
- All communication with the user in Spanish
