set PORT=5100
start "" http://localhost:%PORT%/
python -m http.server %PORT%