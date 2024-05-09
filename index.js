/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    //eventListener
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    return context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.opened", async (context) => {
    const pull_request_title = context.payload.pull_request.title;
    const pull_request_comment = context.payload.pull_request.body;
    console.log(pull_request_title, pull_request_comment);

    const prComment = {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.pull_request.number,
      body: `Thanks for opening this pull request! this copy of ${pull_request_title}\n will be copied on local branch`,
    };

    return context.octokit.issues.createComment(prComment);
  });

  app.on("pull_request.synchronize", async (context) => {
    const prComment = {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: context.payload.pull_request.number,
      body: `Thanks for this ${context.payload.pull_request.title}, I will update the local branch`,
    };

    return context.octokit.issues.createComment(prComment);
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
