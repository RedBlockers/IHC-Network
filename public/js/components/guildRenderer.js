export const displayIcons = () => {
    const token = localStorage.getItem("token");
    const match = window.location.href.match('\\/(\\d+)\\/(\\d+)$')
    const guildId = match ? match[1]: 0;
    axios.post("/guilds/getGuildsByUser", {token: token})
        .then(response => {
            if (response.status === 200) {

                const guilds = response.data;
                const guildContainer = document.getElementById("guildContainer");
                const guildBarContainer = document.getElementById("guildSelectionBarContainer");

                guilds.forEach((guild) => {

                    guildContainer.insertAdjacentHTML("afterbegin",
                    `<div class="mb-2" data-bs-toggle="tooltip" data-bs-placement="right" title="${guild.guildName}" id="guild_${guild.guildId}" onclick="window.location.href = '/${guild.guildId}/0'">
                         <img class="avatar guild" src="../images/${guild.guildImage}" >
                        </div>`);

                    guildBarContainer.insertAdjacentHTML("afterbegin",
                        `<div class="mb-2 selection-bar d-flex align-items-center"" style="height: 45px;" id="guild_${guild.guildId}_selectionBar"><div style="width: 100%;border-radius: 5px;"></div></div>`);
                })

                guildContainer.insertAdjacentHTML("afterbegin",
                    `<div data-bs-toggle="tooltip" data-bs-placement="right" title="Accueil" id="homePage" onclick="window.location.href = '/pages/lobby.html' ">
                         <img class="avatar guild" src="../images/NoScord.jpg" >
                        </div>
                        <hr style="width: 40%" class=" my-2">`);

                guildBarContainer.insertAdjacentHTML("afterbegin",
                    `<div class="mb-2 selection-bar d-flex align-items-center"" style="height: 45px;" id="homePage_selectionBar"><div style="width: 100%;border-radius: 5px;"></div></div>
                          <hr style="width: 0%" class=" my-2">`);

                let elements = Array.from(document.querySelectorAll(".guild"));
                elements.push(document.getElementById('homePage'));
                elements.forEach((element) => {
                    element = element.parentElement;
                    if(element.id !== 'homePage'){

                    }
                    if (element.id !== `guild_${guildId}`) {
                        element.addEventListener("mouseover", (e) => {
                            try {
                                const selectionBarParentId = `${element.id}_selectionBar`;
                                const selectionBar = document.getElementById(selectionBarParentId).children[0];
                                selectionBar.classList.add('hovered');
                            } catch (e) {
                            }

                        })
                        element.addEventListener("mouseout", (e) => {
                            try {
                                const selectionBarParentId = `${element.id}_selectionBar`;
                                const selectionBar = document.getElementById(selectionBarParentId).children[0];
                                selectionBar.classList.remove('hovered');
                                const animation = selectionBar.animate([{
                                    backgroundColor: 'white',
                                    height: '30%'
                                }, {
                                    backgroundColor: 'transparent',
                                    height: '0%'
                                }], {duration: 300});
                            } catch (e) {
                            }

                        })
                    }
                })

                const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
                const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
            }

            const selctedGuildSelectionBar = document.getElementById(`guild_${guildId}_selectionBar`);
            selctedGuildSelectionBar.children[0].classList.add('selected');
        });
};
