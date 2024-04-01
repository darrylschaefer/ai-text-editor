
import { ArrowLeft } from '@carbon/icons-react';
import Faq from "react-faq-component";

const config = {
    animate: true,
    tabFocus: true
};


function FAQs () {
    return (
<div className="w-full h-full max-w-full relative overflow-scroll">
          <HeaderLinks header={"Frequently Asked Questions"} subheader={""} />
          <div className="w-[900px] max-w-full  m-auto mt-6">
          <Faq data={data} styles={styles} config={config} />
          </div>
          <div className="w-[900px] max-w-full m-auto mt-6">
          <Faq data={functionalityData} styles={styles} config={config} />
          </div>
          <FooterLinks />
          </div>        
    )
}

function HeaderLinks({header, subheader}: {header: string, subheader: string})
{
  return (
  <div>
    <div className="w-[900px] max-w-full m-auto flex h-20 text-white-900">
            <div className="flex justify-center items-center">
              <a href="/" className='flex justify-center items-center'>
                <div className="pr-2"><ArrowLeft /></div>
                <span className="pr-2">Back to ai-text-editor</span>
                </a>
            </div>
          </div>
          <div className="w-[900px] max-w-full m-auto mt-6 text-center">
          <h3 className="pb-2 font-medium text-xl">{header}</h3>
          {subheader.length > 0 ? (<div><p className="">Last updated: {subheader}</p></div>) : (<div></div>)}
          </div>
    </div>
  )
}

function FooterLinks(){
  return (
    <div className="py-6 mt-3 w-[900px] max-w-full m-auto flex justify-center">
      <div className="px-3 opacity-30">|</div>
      <a href="/">Back to ai-text-editor</a><div className="px-3 opacity-30">|</div>
      <a href="/faqs">FAQs</a><div className="px-3 opacity-30">|</div>
    </div>
  )
}

const data = {
    title: "About",
    rows: [
        {
            title: "What is this application?",
            content: `Ai-text-editor is a web application word processor built to interact with AI models via API access. It allows you to manage and manipulate documents using a document management systme, send requests to AI model providers, and includes useful quality-of-life features, such as instant macros and selection sending. The OpenAI Chat API is accessed directly from your browser using your own API key, which is stored locally in your browser.`
        },
        {
            title: "Do you have access to our documents?",
            content: "Your documents are stored locally via your browser via IndexedDB.",
        },
        {
            title: "Does anyone have access to our documents?",
            content: `If you use the OpenAI API or any custom API, you may send document and selection data to their servers in the processing of the request.`,
        },
        {
            title: "Where is our data stored?",
            content: `Locally in your browser via IndexedDB. Routinely export your data in order to back it up!`,
        },
        {
          title: "How do I back up my data?",
          content: "Your data should be routinely backed up by using the 'export' feature in the sidebar. This will give you a .JSON file of your documents and chats that can later be imported back into the application."
        },
        {
          title: "How is our API key stored?",
          content: "Your API key is stored locally in your browser."
        },
        {
          title: "Do I need to pay OpenAI?",
          content: "Yes. You use your own API key to interface directly with the OpenAI servers. It's recommended to set soft and hard limits in your OpenAI dashboard and check in to monitor spending."
        },
        {
          title: "Is there a mobile / desktop version?",
          content: "AI-text-editor is accessible on both desktop and mobile devices!"
        }
    ],
};

const functionalityData = {
    title: "More information",
    rows: [
      {
        title: "How do I clear the chat?",
        content: "You can clear your chat by following these steps:<br><br>1. Find the 'Chat' menu on your screen.<br>2. Click the Clear Chat button (indicated by a trash can icon) found in the 'Chat' menu.<br>3. This will automatically clear your current chat and set the prompt to your default message.<br>4. Note: your previous conversation may be saved and accessible in the 'Chat History' tab."
      },
      {
        title: "How do I change the default system chat message?",
        content: "1. Locate the 'Settings' button found in the footer links beneath your documents.<br>2. Click 'Settings' to access a menu.<br>3. In this menu, find and click the 'Chat Config' option.<br>4. This allows you to set or alter the default chat message."
      },
      {
        title: "How do I create new prompts?",
        content: "1. Locate the 'Settings' button found in the footer links, underneath your documents.<br>2. Click the 'Settings' button to open the settings menu.<br>3. In this menu, find and click the 'Prompt Library' option.<br>4. This will give you the option to update your prompt library as needed."
      },
      {
        title: "How do I set the chat to a prompt from my library?",
        content: "1. Find the 'Chat' menu on your screen.<br>2. Click the lightbulb icon within the chat menu to access your prompt library.<br>3. In the prompt library, you can choose to do one of two things with each prompt: <br>&emsp;a) To set one as your current prompt, simply click on the desired prompt.<br>&emsp;b) To instantly run a prompt as a macro, click on the magic wand icon next to it."
      },
      { title: "What are prompt macros?",
      content: "1. Understand that prompt macros are prompts designed to generate an output instantly without further input.<br>2. Take into account that prompts have customizable configuration settings.<br>&emsp;a) This enables you to set a custom model setting or even send your current document selection.<br>3. Attempt to create prompts based on these settings to swiftly generate the desired outputs."
    },
      {
        title: "How do I create prompt macros?",
        content: "1. To create a prompt macro, you would follow the same steps as when creating a regular prompt.<br>2. Notice, if you choose to run a prompt as a macro, it will execute instantly.<br>3. If your macro is designed to work with an 'Included Selection', ensure to create your prompt accordingly.<br>4. For a better understanding of how to structure your macros, it's recommended to refer to the default template prompt macros as examples."
      },
      {
        title: "How do I run a prompt macro?",
        content: "1. Navigate to the 'Chat' menu on your screen.<br>2. Click on the lightbulb icon to open the prompt library menu.<br>3. Each prompt in this menu has a magic wand icon to the right. Click on this to run that prompt instantly as a 'Prompt Macro'.<br>4. If you have the 'Include Selection' option enabled, your current selection will be automatically added to the end of your prompt on a new line."
      },
      {
        title: "How do I send the current selection to OpenAI?",
        content: "You can include your most recent selection in a chat message by toggling the 'Include Selection' button near the chat send. This will append the current selection to your chat message, separated by a new line. You can include your most recent selection in a Prompt Macro by opening its individual settings and enabling this feature. This will append your most recent selection to the bottom of your system prompt, separated by a new line."
      },
      {
        title: "Is there a way to change the configuration settings for the OpenAI Chat?",
        content: "To change your global chat configuration in the chat menu:<br><br>1. Locate the 'Chat' menu on your screen.<br>2. Click on the 'Configuration' tab within the chat menu.<br>3. This will open the global chat configuration settings.<br>4. Here, you can modify the default model that is used for chat conversations.<br><br>Prompt macros have the ability to temporarily override the default configuration. If a prompt macro has overwritten the default configuration:<br><br>1. Look for the gear icon located next to the send button in the chat menu.<br>2. The presence of the gear icon indicates that a prompt macro has set a custom configuration in effect.<br>3. By clicking the button, you can delete the custom configuration and revert to using the default configuration for the chat."
      }
    ]
  }
  
  const styles = {
      bgColor: 'transparent',
      titleTextColor: "black",
      rowTitleColor: "black",
      titleTextSize: '1.25rem',
      rowContentTextSize: '1rem',
      rowContentPaddingTop: '.5rem',
      rowContentPaddingBottom:'.5rem',
      rowTitleTextSize: '1rem'
  };
  
  export default FAQs;