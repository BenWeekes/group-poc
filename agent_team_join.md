# Proposed Agora ConvoAI session payload

```json
{
  "llm": {
    "url": "https://api.openai.com/v1/chat/completions",
    "api_key": "{{secrets.openai}}",
    "vendor": "openai",
    "style": "openai",
    "params": {
      "model": "gpt-4o-mini",
      "temperature": 0.2
    },
    "max_history": 24,
    "failure_message": "I'm sorry, I can't access that right now. I'll arrange a specialist to help.",
    "greeting_message": "Hello. May I speak with the person this call is for?",
    "variables": {
      "organization_name": "Example Financial Services",
      "todays_date": "2026-07-22",
      "outbound_call": true,
      "contact_allowed_now": true,
      "contact_attempt_number": 1,
      "dialed_phone": "+441632960123",
      "contact_first_name": "",
      "campaign_id": "",
      "case_id": "",
      "human_specialist_number": "+441632960999"
    },
    "tools": [
      {
        "name": "verify_right_party",
        "type": "rest",
        "description": "Verify that the current speaker is the intended person using caller-provided challenge answers. Do not disclose account, balance, creditor, repayment, or identifier information before this succeeds.",
        "parameters": {
          "type": "object",
          "properties": {
            "challenge_answer": {
              "type": "string",
              "description": "Answer provided by the caller; never an identifier read aloud by the agent."
            }
          },
          "required": ["challenge_answer"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/call-verification/right-party",
          "headers": {
            "Authorization": "Bearer {{secrets.identity}}"
          },
          "body": {
            "case_id": "{{vars.case_id}}",
            "dialed_phone": "{{vars.dialed_phone}}",
            "challenge_answer": "{{params.challenge_answer}}"
          },
          "timeout_ms": 3000
        },
        "response": {
          "capture": {
            "right_party_verified": "$.verified",
            "customer_id": "$.customer.id",
            "customer_display_name": "$.customer.display_name",
            "contact_preference": "$.customer.contact_preference"
          },
          "return": "$.result",
          "on_empty": "Verification could not be completed."
        }
      },
      {
        "name": "get_account_summary",
        "type": "rest",
        "description": "Retrieve a short, approved account summary only after right-party verification.",
        "parameters": {
          "type": "object",
          "properties": {},
          "required": []
        },
        "request": {
          "method": "GET",
          "url": "https://api.example.com/v1/accounts/summary?customer_id={{vars.customer_id}}&case_id={{vars.case_id}}",
          "headers": {
            "Authorization": "Bearer {{secrets.crm}}"
          },
          "timeout_ms": 3000
        },
        "response": {
          "capture": {
            "account_status": "$.status",
            "approved_balance": "$.balance.display",
            "approved_due_date": "$.next_due_date",
            "payment_status": "$.payment_status"
          },
          "return": "$.approved_spoken_summary",
          "on_empty": "No approved account summary is available."
        }
      },
      {
        "name": "get_payment_options",
        "type": "rest",
        "description": "Return only pre-approved payment methods, instalments, and promise-to-pay options for the verified customer.",
        "parameters": {
          "type": "object",
          "properties": {
            "requested_date": {
              "type": "string",
              "description": "ISO date offered by the caller, if any."
            },
            "requested_amount": {
              "type": "number",
              "description": "Amount offered by the caller, if any."
            }
          }
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/payment-options/quote",
          "headers": {
            "Authorization": "Bearer {{secrets.payments}}"
          },
          "body": {
            "customer_id": "{{vars.customer_id}}",
            "case_id": "{{vars.case_id}}",
            "requested_date": "{{params.requested_date}}",
            "requested_amount": "{{params.requested_amount}}"
          },
          "timeout_ms": 4000
        },
        "response": {
          "capture": {
            "payment_options_available": "$.options",
            "requires_human_approval": "$.requires_human_approval"
          },
          "return": "$.spoken_options",
          "on_empty": "No automatic option is available."
        }
      },
      {
        "name": "record_promise_to_pay",
        "type": "rest",
        "description": "Record an agreed, non-coercive promise to pay. Use only after the caller states a date and amount and the agent has confirmed both.",
        "parameters": {
          "type": "object",
          "properties": {
            "payment_date": {
              "type": "string",
              "description": "Confirmed ISO date."
            },
            "amount": {
              "type": "number",
              "description": "Confirmed amount."
            }
          },
          "required": ["payment_date", "amount"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/promises-to-pay",
          "headers": {
            "Authorization": "Bearer {{secrets.payments}}"
          },
          "body": {
            "customer_id": "{{vars.customer_id}}",
            "case_id": "{{vars.case_id}}",
            "payment_date": "{{params.payment_date}}",
            "amount": "{{params.amount}}"
          },
          "timeout_ms": 4000
        },
        "response": {
          "capture": {
            "promise_to_pay_id": "$.id",
            "contact_suppressed_until": "$.contact_suppressed_until"
          },
          "return": "$.confirmation",
          "on_empty": "The promise could not be recorded."
        }
      },
      {
        "name": "open_payment_investigation",
        "type": "rest",
        "description": "Open a payment investigation for failed, pending, duplicated, restricted, or misapplied payments. A payment sent to the wrong place is treated as a possible scam outcome.",
        "parameters": {
          "type": "object",
          "properties": {
            "issue_type": {
              "type": "string",
              "enum": ["failed", "pending", "duplicate", "restricted_account", "wrong_destination", "other"]
            },
            "summary": {
              "type": "string",
              "description": "Neutral factual summary; do not include full account or card numbers."
            }
          },
          "required": ["issue_type", "summary"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/payment-investigations",
          "headers": {
            "Authorization": "Bearer {{secrets.payments}}"
          },
          "body": {
            "customer_id": "{{vars.customer_id}}",
            "case_id": "{{vars.case_id}}",
            "issue_type": "{{params.issue_type}}",
            "summary": "{{params.summary}}"
          },
          "timeout_ms": 4000
        },
        "response": {
          "capture": {
            "payment_investigation_id": "$.reference"
          },
          "return": "$.next_steps",
          "on_empty": "No investigation could be opened."
        }
      },
      {
        "name": "create_hardship_case",
        "type": "rest",
        "description": "Create a restricted hardship or vulnerability case and suspend collection activity according to policy. Use for inability to pay, distress, despair, sleep-loss, humiliation, or safety concerns.",
        "parameters": {
          "type": "object",
          "properties": {
            "reason": {
              "type": "string",
              "description": "Short factual reason."
            },
            "severity": {
              "type": "string",
              "enum": ["standard", "urgent", "immediate_safety"]
            }
          },
          "required": ["reason", "severity"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/hardship-cases",
          "headers": {
            "Authorization": "Bearer {{secrets.case_management}}"
          },
          "body": {
            "customer_id": "{{vars.customer_id}}",
            "case_id": "{{vars.case_id}}",
            "reason": "{{params.reason}}",
            "severity": "{{params.severity}}"
          },
          "timeout_ms": 3000
        },
        "response": {
          "capture": {
            "hardship_case_id": "$.reference",
            "payment_requests_suspended": "$.payment_requests_suspended"
          },
          "return": "$.safe_next_step"
        }
      },
      {
        "name": "create_dispute_or_fraud_case",
        "type": "rest",
        "description": "Create a dispute or fraud case for account ownership, balance, payment routing, unauthorized transaction, or scam concerns.",
        "parameters": {
          "type": "object",
          "properties": {
            "category": {
              "type": "string",
              "enum": ["identity", "account", "balance", "transaction", "payment_instruction", "scam"]
            },
            "summary": {
              "type": "string"
            }
          },
          "required": ["category", "summary"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/disputes",
          "headers": {
            "Authorization": "Bearer {{secrets.case_management}}"
          },
          "body": {
            "customer_id": "{{vars.customer_id}}",
            "case_id": "{{vars.case_id}}",
            "category": "{{params.category}}",
            "summary": "{{params.summary}}"
          },
          "timeout_ms": 4000
        },
        "response": {
          "capture": {
            "dispute_case_id": "$.reference"
          },
          "return": "$.next_steps"
        }
      },
      {
        "name": "register_contact_preference",
        "type": "rest",
        "description": "Immediately record a request to stop calls/messages or change communication preferences. This tool must be called before any further discussion when such a request is made.",
        "parameters": {
          "type": "object",
          "properties": {
            "preference": {
              "type": "string",
              "enum": ["stop_calls", "stop_messages", "stop_all_nonrequired_contact", "callback_request"]
            }
          },
          "required": ["preference"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/contact-preferences",
          "headers": {
            "Authorization": "Bearer {{secrets.crm}}"
          },
          "body": {
            "customer_id": "{{vars.customer_id}}",
            "case_id": "{{vars.case_id}}",
            "dialed_phone": "{{vars.dialed_phone}}",
            "preference": "{{params.preference}}"
          },
          "timeout_ms": 3000
        },
        "response": {
          "capture": {
            "contact_preference": "$.preference",
            "contact_suppressed": "$.suppressed"
          },
          "return": "$.confirmation"
        }
      },
      {
        "name": "send_official_follow_up",
        "type": "rest",
        "description": "Send a verified written summary, payment link, payment reference, or promise-to-pay confirmation to the customer's registered contact method. Never use chat apps, QR codes, personal accounts, or caller-provided side channels.",
        "parameters": {
          "type": "object",
          "properties": {
            "message_type": {
              "type": "string",
              "enum": ["payment_options", "promise_to_pay_confirmation", "payment_investigation", "dispute_confirmation", "hardship_follow_up"]
            }
          },
          "required": ["message_type"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/official-communications",
          "headers": {
            "Authorization": "Bearer {{secrets.communications}}"
          },
          "body": {
            "customer_id": "{{vars.customer_id}}",
            "case_id": "{{vars.case_id}}",
            "message_type": "{{params.message_type}}"
          },
          "timeout_ms": 4000
        },
        "response": {
          "capture": {
            "official_message_reference": "$.reference"
          },
          "return": "$.delivery_summary"
        }
      },
      {
        "name": "log_safety_incident",
        "type": "rest",
        "description": "Log prohibited payment routing, side-channel requests, coercion, privacy concerns, repeated demands, or safety-risk language for compliance review.",
        "parameters": {
          "type": "object",
          "properties": {
            "incident_type": {
              "type": "string",
              "enum": ["side_channel", "payment_routing", "privacy", "coercion", "distress", "other"]
            },
            "summary": {
              "type": "string"
            }
          },
          "required": ["incident_type", "summary"]
        },
        "request": {
          "method": "POST",
          "url": "https://api.example.com/v1/compliance-incidents",
          "headers": {
            "Authorization": "Bearer {{secrets.compliance}}"
          },
          "body": {
            "case_id": "{{vars.case_id}}",
            "incident_type": "{{params.incident_type}}",
            "summary": "{{params.summary}}"
          },
          "timeout_ms": 3000
        },
        "response": {
          "capture": {
            "safety_incident_id": "$.reference"
          },
          "return": "$.result"
        }
      },
      {
        "name": "transfer_to_human_specialist",
        "type": "system",
        "action": "transfer",
        "description": "Warm-transfer the live call to an authorised human specialist.",
        "destination": "{{vars.human_specialist_number}}",
        "mode": "warm",
        "handover_summary": "Verified: {{vars.right_party_verified}}. Customer: {{vars.customer_display_name}}. Case: {{vars.case_id}}. Reason: {{vars.escalation_reason}}. Safety incident: {{vars.safety_incident_id}}. Hardship case: {{vars.hardship_case_id}}."
      }
    ],
    "agents": [
      {
        "name": "outbound_intake",
        "max_history": 10,
        "params": {
          "temperature": 0
        },
        "system_messages": [
          {
            "role": "system",
            "content": "You are the outbound call intake agent for {{vars.organization_name}}. First check {{vars.contact_allowed_now}}. If false, end politely without discussing the account. Do not disclose the reason for calling, any debt, balance, creditor, account, repayment, or personal data until right-party verification succeeds. Ask a neutral verification question and call verify_right_party with the caller-provided answer. Never read identifiers aloud, including account numbers, ID digits, date of birth, balance, or payment dates. If this is a wrong number, third party, voicemail, or verification fails, say only that you will update the record and end the call. Keep replies under 20 words."
          }
        ],
        "tools": ["verify_right_party"],
        "handoffs": [
          {
            "to": "account_status",
            "description": "Right-party verification succeeded and the caller is ready to discuss the account.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 8
            },
            "capture": {
              "type": "object",
              "properties": {
                "right_party_verified": {
                  "type": "boolean"
                },
                "customer_id": {
                  "type": "string"
                }
              },
              "required": ["right_party_verified", "customer_id"]
            }
          }
        ]
      },
      {
        "name": "account_status",
        "max_history": 20,
        "params": {
          "temperature": 0.1
        },
        "requires": ["right_party_verified", "customer_id"],
        "transition_message": null,
        "system_messages": [
          {
            "role": "system",
            "content": "You explain only approved account facts to a verified caller. Call get_account_summary before stating account-specific information. Be calm and factual. Do not pressure, threaten, repeat payment demands, discuss a personal payment account, give payment details verbally, or ask the caller to open an app, read a balance, or screen-share. If the caller offers a date or amount, hand off to payment_options. If they cannot pay or show distress, hand off to hardship_support. If facts are disputed or a payment instruction seems suspicious, hand off to dispute_fraud. Keep replies under 30 words."
          }
        ],
        "tools": ["get_account_summary"],
        "handoffs": [
          {
            "to": "payment_options",
            "description": "Caller asks about approved payment methods, instalments, a due-date option, offers a date/amount, or asks about a partial payment.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            }
          },
          {
            "to": "payment_troubleshooting",
            "description": "Caller reports a failed, pending, duplicate, restricted, or missing payment.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            }
          },
          {
            "to": "hardship_support",
            "description": "Caller cannot pay, requests more time because of affordability, or expresses distress.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            }
          },
          {
            "to": "dispute_fraud",
            "description": "Caller disputes identity, ownership, balance, transaction, account, or payment instructions.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            }
          }
        ]
      },
      {
        "name": "payment_options",
        "max_history": 20,
        "params": {
          "temperature": 0.1
        },
        "requires": ["right_party_verified", "customer_id"],
        "transition_message": null,
        "system_messages": [
          {
            "role": "system",
            "content": "You offer only pre-approved payment options. Call get_payment_options before describing an option. Never negotiate or promise a settlement, waiver, fee change, or exception without human approval. If the caller proposes a date and amount, confirm both once, then call record_promise_to_pay and send_official_follow_up. Do not repeat a payment request after refusal or distress. Never give payment details by voice or via WeChat, QQ, SMS, QR code, social media, or a personal account. Hand off cease-contact requests immediately. Keep replies under 30 words."
          }
        ],
        "tools": ["get_payment_options", "record_promise_to_pay", "send_official_follow_up"],
        "handoffs": [
          {
            "to": "hardship_support",
            "description": "Caller cannot afford an option, requests more time due to hardship, or expresses distress.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            }
          },
          {
            "to": "human_specialist",
            "description": "Caller requests or needs a settlement, partial-payment exception, fee waiver, legal answer, or any option requiring human approval.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            },
            "capture": {
              "type": "object",
              "properties": {
                "escalation_reason": {
                  "type": "string"
                }
              },
              "required": ["escalation_reason"]
            }
          }
        ]
      },
      {
        "name": "payment_troubleshooting",
        "max_history": 18,
        "params": {
          "temperature": 0.1
        },
        "requires": ["right_party_verified", "customer_id"],
        "transition_message": null,
        "system_messages": [
          {
            "role": "system",
            "content": "You handle payment problems only: failed or repeated auto-debits, changed cards, pending or duplicate payments, restricted receiving accounts, and missing payments. Ask for a neutral summary, never full card, bank, or account numbers. Call open_payment_investigation. If money may have been sent to the wrong place, a person, a side channel, or an unverified account, hand off to dispute_fraud immediately. Do not ask the caller to open any banking or wallet app. Keep replies under 30 words."
          }
        ],
        "tools": ["open_payment_investigation", "send_official_follow_up"],
        "handoffs": [
          {
            "to": "dispute_fraud",
            "description": "Payment was sent to the wrong place, may be a scam, is unauthorized, or used an unverified payment instruction.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            }
          },
          {
            "to": "human_specialist",
            "description": "Investigation needs manual reconciliation or the caller requests a person.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 10
            },
            "capture": {
              "type": "object",
              "properties": {
                "escalation_reason": {
                  "type": "string"
                }
              },
              "required": ["escalation_reason"]
            }
          }
        ]
      },
      {
        "name": "hardship_support",
        "max_history": 24,
        "params": {
          "temperature": 0.1
        },
        "requires": ["right_party_verified", "customer_id"],
        "transition_message": "I hear that this is difficult. I will stop discussing payment for now and get the right support.",
        "system_messages": [
          {
            "role": "system",
            "content": "You support callers with hardship or distress. Do not ask for payment, set a deadline, debate, or continue collection during this call. For inability to pay, sleep loss, humiliation, despair, self-harm references, or immediate safety concerns, call create_hardship_case with the appropriate severity. For immediate safety concerns, use the approved emergency script and transfer to a human specialist. Keep replies under 25 words."
          }
        ],
        "tools": ["create_hardship_case", "send_official_follow_up"],
        "handoffs": [
          {
            "to": "human_specialist",
            "description": "A hardship case is created, the caller is distressed, an immediate safety concern is present, or a human is requested.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            },
            "capture": {
              "type": "object",
              "properties": {
                "escalation_reason": {
                  "type": "string"
                }
              },
              "required": ["escalation_reason"]
            }
          }
        ]
      },
      {
        "name": "dispute_fraud",
        "max_history": 22,
        "params": {
          "temperature": 0.1
        },
        "requires": ["right_party_verified", "customer_id"],
        "transition_message": "I will record this as a dispute and make sure it is reviewed.",
        "system_messages": [
          {
            "role": "system",
            "content": "You handle account, balance, identity, transaction, payment-routing, and scam disputes. Do not argue or seek payment. Gather a short factual summary, call create_dispute_or_fraud_case, and send a confirmation through the official channel where appropriate. Any request to use WeChat, QQ, SMS, QR codes, social media, a personal account, or an unverified payment route is a safety incident: log it and transfer to a human specialist. Keep replies under 30 words."
          }
        ],
        "tools": ["create_dispute_or_fraud_case", "log_safety_incident", "send_official_follow_up"],
        "handoffs": [
          {
            "to": "human_specialist",
            "description": "A dispute, suspected fraud, side-channel payment instruction, compliance incident, or human request requires investigation.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 12
            },
            "capture": {
              "type": "object",
              "properties": {
                "escalation_reason": {
                  "type": "string"
                }
              },
              "required": ["escalation_reason"]
            }
          }
        ]
      },
      {
        "name": "contact_preference",
        "available_from": "*",
        "max_history": 8,
        "params": {
          "temperature": 0
        },
        "transition_message": "Understood. I will record that now.",
        "system_messages": [
          {
            "role": "system",
            "content": "The caller has asked to stop calls or messages. Immediately call register_contact_preference. Do not ask for payment, argue, persuade, or continue discussing the account. After confirmation, hand off to human_specialist for any required follow-up. Keep replies under 15 words."
          }
        ],
        "tools": ["register_contact_preference"],
        "handoffs": [
          {
            "to": "human_specialist",
            "description": "The preference has been recorded or a human is required to resolve a communication restriction.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 6
            },
            "capture": {
              "type": "object",
              "properties": {
                "escalation_reason": {
                  "type": "string",
                  "description": "Contact preference or cease-contact request."
                }
              },
              "required": ["escalation_reason"]
            }
          }
        ]
      },
      {
        "name": "safety_compliance",
        "available_from": "*",
        "max_history": 10,
        "params": {
          "temperature": 0
        },
        "transition_message": "I can't assist with that request. I'll connect you with a specialist.",
        "system_messages": [
          {
            "role": "system",
            "content": "You handle a prohibited side-channel or conduct-risk signal. This includes a request to use WeChat, QQ, SMS, a QR code, social media, a personal account, an unverified payment route, banking/wallet-app actions, screen sharing, threats, third-party pressure, or repeated payment demands. Do not provide payment instructions or continue payment discussion. Call log_safety_incident, then hand off to human_specialist. Keep replies under 18 words."
          }
        ],
        "tools": ["log_safety_incident"],
        "handoffs": [
          {
            "to": "human_specialist",
            "description": "A safety or compliance incident has been logged and requires human review.",
            "context": {
              "mode": "user_and_assistant",
              "max_messages": 8
            },
            "capture": {
              "type": "object",
              "properties": {
                "escalation_reason": {
                  "type": "string"
                }
              },
              "required": ["escalation_reason"]
            }
          }
        ]
      },
      {
        "name": "human_specialist",
        "available_from": "*",
        "max_history": 6,
        "params": {
          "model": "gpt-4o-mini",
          "temperature": 0
        },
        "transition_message": "One moment, I'll connect you with a specialist.",
        "system_messages": [
          {
            "role": "system",
            "content": "Call transfer_to_human_specialist immediately. Say nothing else."
          }
        ],
        "tools": ["transfer_to_human_specialist"],
        "handoffs": []
      }
    ]
  }
}
```
