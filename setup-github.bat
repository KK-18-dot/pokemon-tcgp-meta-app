@echo off
echo === Pokemon TCG Meta App GitHub Setup ===
echo.

REM GitHubリポジトリ作成後に実行してください
REM 1. GitHub.comでリポジトリ "pokemon-tcgp-meta-app" を作成
REM 2. このスクリプトを実行

echo Step 1: Adding files to git...
git add .
git commit -m "🚀 Initial commit: Pokemon TCG Pocket Meta Analysis System

📊 Environment-Adaptive Meta Score Analysis
🎯 Features:
- Deck scraping from Limitless TCG
- Matchup data collection
- Expected win rate calculation
- Weekly automated reports
- GitHub Actions integration

🤖 Generated with Claude Code"

echo.
echo Step 2: Setting up remote repository...
echo 以下のコマンドを手動で実行してください（YOUR_USERNAMEを実際のGitHubユーザー名に置換）:
echo.
echo git remote add origin https://github.com/YOUR_USERNAME/pokemon-tcgp-meta-app.git
echo git branch -M main
echo git push -u origin main
echo.
echo Step 3: GitHub Actions will be automatically enabled!
echo Next weekly report: 次の金曜日 15:00 JST
echo.
pause