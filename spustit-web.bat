@echo off
rem ============================================================
rem  Fortissima - lokalny testovaci server (PHP)
rem  Dvojklik: spusti web na http://localhost:8000 a otvori kalkulaciu.
rem  Kalkulacka cita ceny priamo z _cennik\*.csv - po zmene CSV staci F5.
rem  Zastavenie: zavriet toto okno (alebo Ctrl+C).
rem ============================================================
setlocal
cd /d "%~dp0"
set PORT=8000

rem --- najdi PHP: C:\php, potom PATH ---
set "PHP="
if exist "C:\php\php.exe" set "PHP=C:\php\php.exe"
if not defined PHP (
  for /f "delims=" %%P in ('where php 2^>nul') do if not defined PHP set "PHP=%%P"
)
if not defined PHP (
  echo.
  echo  PHP sa nenaslo.
  echo  1. Stiahnite "VS17 x64 Non Thread Safe" ZIP z https://windows.php.net/download/
  echo  2. Rozbalte ho do priecinka C:\php  ^(tak, aby existoval C:\php\php.exe^)
  echo  3. Spustite tento subor znova.
  echo.
  start "" "https://windows.php.net/download/"
  pause
  exit /b 1
)

echo.
echo  Fortissima bezi na  http://localhost:%PORT%
echo  PHP: %PHP%
echo  Ceny: %~dp0_cennik
echo.
echo  Po uprave CSV ulozte subor a v prehliadaci stlacte F5.
echo  Server zastavite zatvorenim tohto okna.
echo.
start "" "http://localhost:%PORT%/kalkulacka.html"
"%PHP%" -S localhost:%PORT% -t "%~dp0."
pause
