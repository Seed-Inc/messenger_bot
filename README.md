# Messenger Bot

[Messenger Platform Docs](https://developers.facebook.com/docs/messenger-platform/complete-guide)

To test out the bot while in development you need to be an admin or tester for the bot page on fb. Once you are, you can interact with it on fb desktop or messenger by searching for Bottestpage in chat.
FB Page: [Bottestpage](https://www.facebook.com/Bottestpage-336372346703232/)
Bot name: Bottestpage

Remote Webhook
```
https://seed-messenger-bot.herokuapp.com/webhook/
```

Verify Token
```
my_voice_is_my_password_verify_me
```

Heroku Remote
```
https://git.heroku.com/seed-messenger-bot.git
```

Setup Greeting Text
```
curl -X POST -H "Content-Type: application/json" -d '{"setting_type":"greeting","greeting":{"text":"Hi, I am Seedbot! I can help you create a community police complaint."}}, "https://graph.facebook.com/v2.6/me/thread_settings?access_token=PAGE_ACCESS_TOKEN"
```

Setup Get Started Button

```
curl -X POST -H "Content-Type: application/json" -d '{"setting_type":"call_to_actions","thread_state":"new_thread","call_to_actions":[{"payload":"STEP:1_GET_STARTED_PAYLOAD"}]}' "https://graph.facebook.com/v2.6/me/thread_settings?access_token=PAGE_ACCESS_TOKEN"
```

Persistent Menu

```
curl -X POST -H "Content-Type: application/json" -d '{"setting_type":"call_to_actions","thread_state":"existing_thread","call_to_actions":[{"type":"postback","title":"Start A New Report","payload":"STEP:2_START_REPORT_PAYLOAD"}]}' "https://graph.facebook.com/v2.6/me/thread_settings?access_token=PAGE_ACCESS_TOKEN"
```

Currently using [ngrok](https://ngrok.com/) for local development & quick testing but it's means changing the webhook in the fb app back before pushing changes.

If you want to learn how to setup a bot from the beginning here is the tutorial I used: [Messenger Bot Setup Tutorial](https://github.com/jw84/messenger-bot-tutorial)
