# <p align="center">ai-text-editor</p>

<p align="center"><img src="https://github.com/darrylschaefer/fthr-write/assets/119073511/9b97e65f-5571-4172-a0d2-9d7ebfdf4cce" style="width:60px;" align="center"></p>

<p align="center">AI-powered text editor designed to streamline your writing workflow. Manage documents, collaborate seamlessly with AI models, and utilize powerful macros for unmatched productivity.</p>
<br>
<p align="center"><img style="width:550px;" src="https://github.com/darrylschaefer/fthr-write/assets/119073511/0066e259-557c-4c40-b303-503ecd5cd67d"></p>

<p align="center">
    <a href="https://fthr.app">Visit Website</a>
    ·
    <a href="https://github.com/darrylschaefer/ai-text-editor/issues/new/choose">Report Bugs</a>
    ·
    <a href="https://github.com/darrylschaefer/ai-text-editor/issues/new/choose">Request Feature</a>
</p>

## **Key Features:**

- **Document Management System:** Easily create, edit, organize and export your writings.
- **AI Integration:** Direct interaction with AI model providers, enhancing your writing with suggestions, edits, and creative ideas.
- **Privacy First:** Your documents and API key are stored locally on your device, ensuring your data remains yours.
- **Instant Macros & Selection Sending:** Improve your workflow with customizable prompts and the ability to query the AI about specific text selections.
- **Mobile & Desktop Accessibility:** Designed for compatibility across both desktop and mobile operating systems

## Prerequisites

Ensure that you have the following prerequisites installed and set up on your system:

1. **Node.js**: The application is built using Node.js, so you need to have it installed on your machine. You can download the latest version of Node.js from the [official website](https://nodejs.org/).

2. **OpenAI API Key**: The application requires an OpenAI API key for AI integration. Sign up for an OpenAI account and obtain an API key from the [OpenAI Developer Dashboard](https://beta.openai.com/signup/).

## **Getting Started**

To begin using ai-text-editor, you can visit our [website](http://fthr.app/) to access or setup your own instance by following the steps below:

1. **Clone the repository:**

```
git clone https://github.com/darrylschaefer/ai-text-editor
```

2. **Change directory:**

```
cd ai-text-editor
```

3. **Install dependencies:**

```
npm install
```

4. **Run the dev server:**

```
npm run dev
```

6. **Open your browser:** Navigate to http://localhost:5173 to start working with ai-text-editor on your local machine.

### **Support and Contributions**

We welcome contributions and feedback to make ai-text-editor even better. Whether it's feature requests, bug reports, or code contributions, please feel free to reach out or open an issue in our repository.

### **Privacy and Security**

All data, including documents and your API key, remain stored locally on your browser. No third-party access to your documents unless you choose to interact with external APIs (such as the OpenAI Chat API), which is done under your control with your API key.

### **Mobile/Desktop Version**

ai-text-editor supports both mobile and desktop access, ensuring you can continue your work seamlessly across devices. For the best experience, it's recommended to use the latest version of Chrome.

### **Backup and Data Management**

It's crucial to regularly export your data for backups. Through the sidebar's 'export' feature, you can save your documents and chats securely and import them back at any time.

## **Frequently Asked Questions (FAQs)**

**Q: How is our data stored, and who has access?**

A: Your documents are stored locally on your device via IndexedDB. If you use the OpenAI API or any custom API, you might send document and selection data to their servers during the request process.

**Q: How do I back up my data?**

A: You can routinely back up your data by using the 'export' feature in the sidebar. This action will generate a .JSON file of your documents and chats.

**Q: Do I need to pay OpenAI?**

A: Yes, using your own API key means you'll interface directly with the OpenAI servers, so it's recommended to set limits and monitor spending in your OpenAI dashboard. If you use an alternative API, you may need to pay to the provider of this API.

For more detailed information, please refer to our [FAQ section](http://fthr.app/faqs).

## Special Thanks

This project was inspired by and adapted from [BetterChatGPT](https://github.com/ztjhz/BetterChatGPT), originally released under the CC0 license. This modified version is released under the MIT license.
